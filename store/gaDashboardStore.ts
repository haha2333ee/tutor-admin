"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { supabase } from "@/lib/supabase/client";

/* ====== 配置（与你的库一致） ====== */
const EVENTS_TABLE = "ga_daily_events";
const SITES_TABLE  = "sites";

/* 自动/增强事件白名单 */
const AUTO_EVENTS = [
    "page_view",
    "session_start",
    "user_engagement",
    "first_visit",
    "scroll",
    "click",
] as const;

export type GeoLevel = "country" | "region" | "city" | "continent" | "subContinent";

/* ====== 工具函数 ====== */
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const n = (v: unknown) => Number(v ?? 0);

function toYmd(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
function dateNDaysAgo(nDays: number) {
    const d = new Date();
    d.setDate(d.getDate() - nDays);
    return toYmd(d);
}
function dateRange(start: string, end: string) {
    const out: string[] = [];
    let cur = new Date(start);
    const endD = new Date(end);
    while (cur <= endD) {
        out.push(toYmd(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return out;
}
const today       = () => dateNDaysAgo(0);
const yest        = () => dateNDaysAgo(1);
const last7Start  = () => dateNDaysAgo(6);
const last14Start = () => dateNDaysAgo(13);
const last30Start = () => dateNDaysAgo(29);

type EventRow = {
    event_date: string;
    event_name: string;
    event_count: number | string | null;
    property_id: string | number;
    geo_level?: string;
    geo_value?: string;
};
type SiteRow = {
    property_id: string | number | null;
    is_enabled?: boolean | number | string | null;
    is_enable?: boolean | number | string | null;
};

export type TopGeoRow = { label: string; events: number };

type KPIState = { yesterday: number; last7: number; wow: number; loading: boolean; error?: string | null };
type TrendState = { data: { date: string; events: number }[]; loading: boolean; error?: string | null };
type TopGeoState = { title: string; data: TopGeoRow[]; loading: boolean; error?: string | null };
type MixState = {
    pie: { name: string; value: number }[];
    stack7d: Array<Record<string, number | string>>;
    loading: boolean;
    error?: string | null;
};

/** 缓存 TTL（当前为 60 分钟） */
const TTL_MS = 60 * 60 * 1000;

/** 安全把 supabase 的 data 转为目标数组类型（规避 GenericStringError 联合类型） */
const asRows = <T,>(data: unknown | null | undefined): T[] =>
    (data ?? []) as unknown as T[];

type Store = {
    // 筛选 & 缓存键
    onlyAuto: boolean;
    onlyEnabled: boolean;
    geoLevel: GeoLevel;
    cacheKey: string;       // 上一次加载用的 key
    fetchedAt: number;      // 上一次完成时间戳

    setFilters: (p: Partial<Pick<Store, "onlyAuto" | "onlyEnabled" | "geoLevel">>) => void;

    // 四区块数据
    kpi: KPIState;
    trend: TrendState;
    topGeo: TopGeoState;
    mix: MixState;

    // 加载器
    loadAll: (opts?: { force?: boolean }) => Promise<void>;
};

function makeKey(onlyAuto: boolean, onlyEnabled: boolean, geoLevel: GeoLevel) {
    return `auto:${+onlyAuto}|enabled:${+onlyEnabled}|geo:${geoLevel}`;
}

async function getEnabledPropertyIds(onlyEnabled: boolean) {
    if (!onlyEnabled) return null;
    const { data, error } = await supabase.from(SITES_TABLE).select("property_id,is_enabled,is_enable");
    if (error) throw error;
    const on = (v: unknown) => v === true || v === 1 || v === "1" || v === "true";
    const ids = (data ?? [])
        .filter((s: SiteRow) => s.property_id != null && (on(s.is_enabled) || on(s.is_enable)))
        .map((s: SiteRow) => String(s.property_id));
    return ids.length ? ids : [];
}

function baseEventsQuery(
    start: string,
    end: string,
    onlyAuto: boolean,
    onlyEnabled: boolean,
    enabledIds: string[] | null,
    extraSelect: string[] = []
) {
    const cols = ["event_date", "event_name", "event_count", "property_id", ...extraSelect]
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(",");

    // 先构建过滤，再在返回处调用 .returns<EventRow[]>()
    let q = supabase
        .from(EVENTS_TABLE)
        .select(cols, { count: "exact", head: false })
        .gte("event_date", start)
        .lte("event_date", end);

    if (onlyAuto) q = q.in("event_name", AUTO_EVENTS as unknown as string[]);
    if (onlyEnabled && enabledIds && enabledIds.length) q = q.in("property_id", enabledIds);

    // 最后再追加 .returns，避免后续还要继续调用过滤器时报 “in 不存在”
    return q.returns<EventRow[]>();
}

export const useGADashboardStore = create<Store>()(
    persist(
        (set, get) => ({
            onlyAuto: true,
            onlyEnabled: false,
            geoLevel: "country",
            cacheKey: "",
            fetchedAt: 0,
            setFilters: (p) => set(p),

            kpi:   { yesterday: 0, last7: 0, wow: 0, loading: false, error: null },
            trend: { data: [], loading: false, error: null },
            topGeo:{ title: "Top 10 地区访问量（最新日）", data: [], loading: false, error: null },
            mix:   { pie: [], stack7d: [], loading: false, error: null },

            loadAll: async ({ force = false } = {}) => {
                const { onlyAuto, onlyEnabled, geoLevel, cacheKey, fetchedAt } = get();
                const newKey = makeKey(onlyAuto, onlyEnabled, geoLevel);

                // 命中缓存且未过期 → 跳过
                const fresh = Date.now() - fetchedAt < TTL_MS;
                if (!force && cacheKey === newKey && fresh) return;

                const tdy = today();
                const yst = yest();
                const s7  = last7Start();
                const s14 = last14Start();
                const s30 = last30Start();

                // 预设 loading
                set({
                    kpi:   { ...get().kpi, loading: true, error: null },
                    trend: { ...get().trend, loading: true, error: null },
                    topGeo:{ ...get().topGeo, loading: true, error: null },
                    mix:   { ...get().mix, loading: true, error: null },
                });

                try {
                    const enabledIds = await getEnabledPropertyIds(onlyEnabled);
                    if (onlyEnabled && enabledIds && enabledIds.length === 0) {
                        // 启用站点列表为空，直接清零
                        set({
                            kpi:   { yesterday: 0, last7: 0, wow: 0, loading: false, error: null },
                            trend: { data: dateRange(s30, tdy).map(d => ({ date: d.slice(5), events: 0 })), loading: false, error: null },
                            topGeo:{ title: "Top 10 地区访问量（最新日）", data: [], loading: false, error: null },
                            mix:   { pie: [], stack7d: [], loading: false, error: null },
                            cacheKey: newKey,
                            fetchedAt: Date.now(),
                        });
                        return;
                    }

                    // ===== KPI（近14天）
                    const { data: kpiData, error: kpiErr } = await baseEventsQuery(s14, tdy, onlyAuto, onlyEnabled, enabledIds);
                    if (kpiErr) throw kpiErr;
                    const kpiRows = asRows<EventRow>(kpiData);
                    const byDateK = new Map<string, number>();
                    for (const r of kpiRows) byDateK.set(r.event_date, (byDateK.get(r.event_date) ?? 0) + n(r.event_count));
                    const days14 = dateRange(s14, tdy);
                    const totals = days14.map(d => byDateK.get(d) ?? 0);
                    const last7 = sum(totals.slice(-7));
                    const prev7 = sum(totals.slice(-14, -7));
                    const wow   = prev7 === 0 ? 0 : ((last7 - prev7) / prev7) * 100;
                    const yVal  = byDateK.get(yst) ?? 0;

                    // ===== 趋势（近30天）
                    const { data: trendData, error: trendErr } = await baseEventsQuery(s30, tdy, onlyAuto, onlyEnabled, enabledIds);
                    if (trendErr) throw trendErr;
                    const trendRows = asRows<EventRow>(trendData);
                    const byDateT = new Map<string, number>();
                    for (const r of trendRows) byDateT.set(r.event_date, (byDateT.get(r.event_date) ?? 0) + n(r.event_count));
                    const days30 = dateRange(s30, tdy);
                    const trendSeries = days30.map(d => ({ date: d.slice(5), events: byDateT.get(d) ?? 0 }));

                    // ===== Top 地区（最近一日，按 geo_level / geo_value）
                    const { data: baseData, error: baseErr } = await baseEventsQuery(s14, tdy, onlyAuto, onlyEnabled, enabledIds, ["geo_level", "geo_value"]);
                    if (baseErr) throw baseErr;
                    const baseRows = asRows<EventRow>(baseData);
                    let topTitle = "Top 10 地区访问量（最新日）";
                    let topData: TopGeoRow[] = [];
                    if (baseRows.length) {
                        const latestDate = baseRows.map(r => r.event_date).sort().slice(-1)[0];
                        const dayRows = baseRows.filter(r => r.event_date === latestDate && (r.geo_level ?? "").toLowerCase() === geoLevel.toLowerCase());
                        const map = new Map<string, number>();
                        for (const r of dayRows) {
                            const key = String(r.geo_value ?? "Unknown");
                            map.set(key, (map.get(key) ?? 0) + n(r.event_count));
                        }
                        const arr = Array.from(map.entries()).map(([label, events]) => ({ label, events }));
                        arr.sort((a, b) => b.events - a.events);
                        topData = arr.slice(0, 10);
                        topTitle = `Top 10 ${geoLevel} 访问量（${latestDate}）`;
                    }

                    // ===== 事件构成（近7天） 饼图 + 堆叠（Top4 + 其他）
                    const { data: mixData, error: mixErr } = await baseEventsQuery(s7, tdy, onlyAuto, onlyEnabled, enabledIds);
                    if (mixErr) throw mixErr;
                    const mixRows = asRows<EventRow>(mixData);

                    const byEvent = new Map<string, number>();
                    for (const r of mixRows) {
                        const ev = String(r.event_name);
                        byEvent.set(ev, (byEvent.get(ev) ?? 0) + n(r.event_count));
                    }
                    const pieArr = Array.from(byEvent.entries())
                        .map(([name, value]) => ({ name, value }))
                        .sort((a, b) => b.value - a.value);

                    const top4 = pieArr.slice(0, 4).map(d => d.name);
                    const days7 = dateRange(s7, tdy);
                    const stack = days7.map(d => {
                        const row: Record<string, number | string> = { date: d.slice(5) };
                        let other = 0;
                        for (const [ev] of byEvent.entries()) {
                            const daySum = mixRows
                                .filter(r => r.event_date === d && String(r.event_name) === ev)
                                .reduce((acc, r) => acc + n(r.event_count), 0);
                            if (top4.includes(ev)) row[ev] = daySum;
                            else other += daySum;
                        }
                        row["其他"] = other;
                        return row;
                    });

                    // 更新所有区块 & 缓存戳
                    set({
                        kpi:   { yesterday: yVal, last7, wow, loading: false, error: null },
                        trend: { data: trendSeries, loading: false, error: null },
                        topGeo:{ title: topTitle, data: topData, loading: false, error: null },
                        mix:   { pie: pieArr, stack7d: stack, loading: false, error: null },
                        cacheKey: newKey,
                        fetchedAt: Date.now(),
                    });
                } catch (e: any) {
                    const err = e?.message || "failed";
                    set({
                        kpi:   { ...get().kpi,   loading: false, error: err },
                        trend: { ...get().trend, loading: false, error: err },
                        topGeo:{ ...get().topGeo,loading: false, error: err },
                        mix:   { ...get().mix,   loading: false, error: err },
                        cacheKey: get().cacheKey, // 不变
                        fetchedAt: get().fetchedAt,
                    });
                }
            },
        }),
        {
            name: "ga-dashboard-cache",
            storage: createJSONStorage(() => sessionStorage), // 如需跨会话可改为 localStorage
            partialize: (state) => ({
                onlyAuto: state.onlyAuto,
                onlyEnabled: state.onlyEnabled,
                geoLevel: state.geoLevel,
                cacheKey: state.cacheKey,
                fetchedAt: state.fetchedAt,
                kpi: state.kpi,
                trend: state.trend,
                topGeo: state.topGeo,
                mix: state.mix,
            }),
        }
    )
);
