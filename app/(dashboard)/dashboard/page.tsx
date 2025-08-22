"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Settings2, Database } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/* —— 使用已实现的 Zustand Store（带缓存） —— */
import { useGADashboardStore, GeoLevel } from "@/store/gaDashboardStore";

/* 只在客户端加载的图表组件（避免 SSR useContext 报错） */
const TrendChart    = dynamic(() => import("@/components/RechartsClient").then(m => m.TrendChart), { ssr: false });
const TopGeoChart   = dynamic(() => import("@/components/RechartsClient").then(m => m.TopGeoChart), { ssr: false });
const MixPieChart   = dynamic(() => import("@/components/RechartsClient").then(m => m.MixPieChart), { ssr: false });
const MixStackChart = dynamic(() => import("@/components/RechartsClient").then(m => m.MixStackChart), { ssr: false });

/* geo_level 选项（与 store 的类型一致） */
const GEO_LEVEL_OPTIONS = [
    { value: "country",      label: "国家 (country)" },
    { value: "region",       label: "省/州 (region)" },
    { value: "city",         label: "城市 (city)" },
    { value: "continent",    label: "大洲 (continent)" },
    { value: "subContinent", label: "分区 (subContinent)" },
] as const;

const formatNumber = (x: number) => new Intl.NumberFormat().format(x);

export default function GAFourQuadrantDashboard() {
    // —— 从缓存 Store 取筛选与数据，并提供加载器/修改器 ——
    const {
        onlyAuto, onlyEnabled, geoLevel,
        setFilters, loadAll,
        kpi, trend, topGeo, mix,
    } = useGADashboardStore();

    // 本地仅控制“饼图/堆叠”视图切换（数据仍来自缓存）
    const [mixView, setMixView] = useState<"pie" | "stack">("pie");

    // 初次和筛选变化时按 TTL 缓存加载
    useEffect(() => {
        loadAll(); // 命中缓存则不会重新请求
    }, [onlyAuto, onlyEnabled, geoLevel, loadAll]);

    const pieTotal = useMemo(() => mix.pie.reduce((a, b) => a + (b?.value ?? 0), 0), [mix.pie]);
    const wowPositive = kpi.wow >= 0;

    return (
        <div className="p-6 max-w-[120rem] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold">GA4 仪表盘</h1>
                    <p className="text-sm text-gray-500">
                        同筛选条件下 5 分钟内返回缓存；点击右侧按钮可强制刷新。
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="flex items-center gap-2" onClick={() => loadAll({ force: true })}>
                        <Settings2 className="h-4 w-4" />
                        强制刷新
                    </Button>
                </div>
            </div>

            {/* 筛选 */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={onlyAuto}
                        onChange={(e) => setFilters({ onlyAuto: e.target.checked })}
                    />
                    <span className="text-sm">仅自动/增强事件</span>
                </label>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={onlyEnabled}
                        onChange={(e) => setFilters({ onlyEnabled: e.target.checked })}
                    />
                    <span className="text-sm">仅启用（sites.is_enabled）</span>
                </label>

                <label className="flex items-center gap-2 ml-2">
                    <span className="text-sm text-gray-600">排行维度</span>
                    <select
                        value={geoLevel}
                        onChange={(e) => setFilters({ geoLevel: e.target.value as GeoLevel })}
                        className="border px-2 py-1 rounded"
                    >
                        {GEO_LEVEL_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </label>
            </div>

            {/* ===== KPI ===== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="rounded-2xl shadow-sm">
                    <CardContent className="p-4">
                        <div className="text-sm text-gray-500">昨日总事件数</div>
                        <div className="flex items-center justify-between mt-2">
                            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-semibold">
                                {kpi.loading ? "…" : formatNumber(kpi.yesterday)}
                            </motion.div>
                            <TrendingUp className="h-5 w-5 text-gray-400" />
                        </div>
                        {kpi.error && <div className="text-xs text-rose-600 mt-2 break-all">错误：{kpi.error}</div>}
                    </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm">
                    <CardContent className="p-4">
                        <div className="text-sm text-gray-500">近 7 天总数</div>
                        <div className="flex items-center justify-between mt-2">
                            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-semibold">
                                {kpi.loading ? "…" : formatNumber(kpi.last7)}
                            </motion.div>
                            <TrendingUp className="h-5 w-5 text-gray-400" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm">
                    <CardContent className="p-4">
                        <div className="text-sm text-gray-500">环比（近 7 天 vs 前 7 天）</div>
                        <div className="flex items-center justify-between mt-2">
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`text-2xl font-semibold ${wowPositive ? "text-emerald-600" : "text-rose-600"}`}
                            >
                                {kpi.loading ? "…" : `${kpi.wow >= 0 ? "+" : ""}${kpi.wow.toFixed(1)}%`}
                            </motion.div>
                            {wowPositive ? <ArrowUpRight className="h-5 w-5 text-emerald-500" /> : <ArrowDownRight className="h-5 w-5 text-rose-500" />}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ===== 左：趋势（近 30 天） ===== */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                <Card className="rounded-2xl shadow-sm">
                    <CardContent className="p-4">
                        <div className="mb-2">
                            <div className="text-sm text-gray-500">趋势</div>
                            <h2 className="text-lg font-semibold">访问量变化（近 30 天）</h2>
                        </div>
                        <div className="h-72">
                            <TrendChart data={trend.data} />
                        </div>
                        {trend.error && <div className="text-xs text-rose-600 mt-2 break-all">错误：{trend.error}</div>}
                    </CardContent>
                </Card>

                {/* ===== 右：Top 地区（指定 geo_level） ===== */}
                <Card className="rounded-2xl shadow-sm">
                    <CardContent className="p-4">
                        <div className="mb-2">
                            <div className="text-sm text-gray-500">排名</div>
                            <h2 className="text-lg font-semibold">{topGeo.title}</h2>
                        </div>
                        <div className="h-72">
                            <TopGeoChart data={topGeo.data} />
                        </div>
                        {topGeo.error && <div className="text-xs text-rose-600 mt-2 break-all">错误：{topGeo.error}</div>}
                    </CardContent>
                </Card>
            </div>

            {/* ===== 下：事件构成（近 7 天） ===== */}
            <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6 items-stretch">
                <Card className="rounded-2xl shadow-sm 2xl:col-span-2">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <div className="text-sm text-gray-500">细分</div>
                                <h2 className="text-lg font-semibold">事件构成（近 7 天）</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant={mixView === "pie" ? "default" : "outline"}
                                    onClick={() => setMixView("pie")}
                                    className="rounded-full"
                                >
                                    饼图
                                </Button>
                                <Button
                                    variant={mixView === "stack" ? "default" : "outline"}
                                    onClick={() => setMixView("stack")}
                                    className="rounded-full"
                                >
                                    堆叠柱状图
                                </Button>
                            </div>
                        </div>

                        {mixView === "pie" ? (
                            <div className="h-80">
                                <MixPieChart data={mix.pie} />
                                <div className="text-center text-sm text-gray-500 mt-2">
                                    合计：{formatNumber(pieTotal)}
                                </div>
                            </div>
                        ) : (
                            <div className="h-80">
                                <MixStackChart data={mix.stack7d} />
                            </div>
                        )}
                        {mix.error && <div className="text-xs text-rose-600 mt-2 break-all">错误：{mix.error}</div>}
                    </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm 2xl:col-span-1">
                    <CardContent className="p-4 h-full flex flex-col">
                        <div className="text-sm text-gray-500">扩展</div>
                        <h2 className="text-lg font-semibold">漏斗分析 & 留存分析</h2>
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center text-gray-500 text-sm">
                                <div>此处为占位区块。</div>
                                <div>后续可从库里读漏斗/留存聚合结果。</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-6 text-xs text-gray-400 flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>四区块数据来自缓存 Store；默认 TTL 5 分钟，可在 store/gaDashboardStore.ts 中修改。</span>
            </div>
        </div>
    );
}
