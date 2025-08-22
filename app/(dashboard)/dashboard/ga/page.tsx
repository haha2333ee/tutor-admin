'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

type Row = {
    date: string;
    geo: string;
    eventName: string;
    eventCount: number;
};

type ApiResp = {
    params?: {
        level?: 'country' | 'region' | 'city' | 'continent' | 'subContinent';
        start?: string;
        end?: string;
        filteredEvents?: string[] | 'ALL_EVENTS';
    };
    rows?: Row[];
    error?: string;
    save?: { attempted: boolean; ok?: boolean; count?: number; reason?: string };
};

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const LEVEL_OPTIONS = [
    { value: 'country', label: '国家 (country)' },
    { value: 'region', label: '省/州 (region)' },
    { value: 'city', label: '城市 (city)' },
    { value: 'continent', label: '大洲 (continent)' },
    { value: 'subContinent', label: '分区 (subContinent)' },
] as const;

export default function GAWidgetPage() {
    const [inputId, setInputId] = useState('');
    const [propertyId, setPropertyId] = useState('');
    const [start, setStart] = useState('yesterday');
    const [end, setEnd] = useState('today');

    // 新增筛选项
    const [level, setLevel] = useState<'country' | 'region' | 'city' | 'continent' | 'subContinent'>('country');
    const [onlyAuto, setOnlyAuto] = useState(true); // auto=1
    const [eventsText, setEventsText] = useState('page_view,session_start'); // auto=0 生效
    const [saveToDb, setSaveToDb] = useState(true); // 新增：是否保存到库（默认开）
    const [diag, setDiag] = useState(false); // 新增：调试信息

    const [rows, setRows] = useState<Row[]>([]);
    const [err, setErr] = useState<string | null>(null);
    const [debug, setDebug] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [apiParamsEcho, setApiParamsEcho] = useState<ApiResp['params']>();
    const [saveEcho, setSaveEcho] = useState<ApiResp['save']>();

    // 计算要传给后端的查询串
    const queryString = useMemo(() => {
        const qs = new URLSearchParams({
            propertyId,
            start,
            end,
            level,
        });

        // 事件过滤
        if (onlyAuto) {
            qs.set('auto', '1');
        } else {
            qs.set('auto', '0');
            const v = eventsText.trim();
            if (v) qs.set('events', v);
        }

        // 关键：保存到库
        if (saveToDb) qs.set('save', '1');

        // 可选：返回更多诊断
        if (diag) qs.set('diag', '1');

        return qs.toString();
    }, [propertyId, start, end, level, onlyAuto, eventsText, saveToDb, diag]);

    useEffect(() => {
        if (!propertyId) return;

        (async () => {
            setLoading(true);
            setErr(null);
            setDebug(null);
            setRows([]);
            setApiParamsEcho(undefined);
            setSaveEcho(undefined);

            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) {
                    throw new Error('请先登录：未获取到 access_token');
                }

                // 这里的 /api/ga/report 是你 Next.js 的 route 代理到 Supabase Function
                const res = await fetch(`/api/ga/report?${queryString}`, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${session.access_token}` },
                    cache: 'no-store',
                });

                const data: ApiResp = await res.json().catch(() => ({} as ApiResp));
                if (!res.ok) {
                    setDebug(data); // 把 route.ts 返回的详细错误显示出来
                    throw new Error(
                        (data && (data as any).error) ||
                        `HTTP ${res.status}${(data as any)?.status ? ` (edge ${(data as any).status})` : ''}`
                    );
                }

                setRows(data.rows || []);
                setApiParamsEcho(data.params);
                setSaveEcho(data.save);
                if (diag) setDebug(data); // 如果开了 diag，则把整体回包也展示出来
            } catch (e: any) {
                setErr(e?.message || 'failed');
            } finally {
                setLoading(false);
            }
        })();
    }, [propertyId, queryString, diag]);

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold">GA4 按地区统计（自动收集事件）</h1>

            <div className="flex flex-wrap items-center gap-2">
                <input
                    type="text"
                    value={inputId}
                    onChange={(e) => setInputId(e.target.value)}
                    placeholder="输入 propertyId，例如 properties/500856747 或 500856747"
                    className="border px-3 py-2 rounded w-72"
                />
                <button
                    onClick={() => setPropertyId(inputId.trim())}
                    className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                    确认
                </button>

                <div className="ml-4 flex items-center gap-2">
                    <label className="text-sm text-gray-600">start</label>
                    <input
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        className="border px-2 py-1 rounded"
                        placeholder="2024-08-01 / yesterday"
                    />
                    <label className="text-sm text-gray-600">end</label>
                    <input
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                        className="border px-2 py-1 rounded"
                        placeholder="2024-08-07 / today"
                    />
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                {/* 地区层级 */}
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">地区维度</label>
                    <select
                        value={level}
                        onChange={(e) => setLevel(e.target.value as any)}
                        className="border px-2 py-1 rounded"
                    >
                        {LEVEL_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>

                {/* 自动/增强事件开关 */}
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={onlyAuto}
                        onChange={(e) => setOnlyAuto(e.target.checked)}
                    />
                    <span className="text-sm">仅自动/增强型事件（auto）</span>
                </label>

                {/* 自定义事件白名单，在 onlyAuto = false 时可编辑 */}
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">事件白名单</label>
                    <input
                        value={eventsText}
                        onChange={(e) => setEventsText(e.target.value)}
                        className="border px-2 py-1 rounded w-72"
                        placeholder="page_view,session_start"
                        disabled={onlyAuto}
                        title={onlyAuto ? '关闭“仅自动事件”后可编辑' : '逗号分隔'}
                    />
                </div>

                {/* 保存到库 & 诊断 */}
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={saveToDb}
                        onChange={(e) => setSaveToDb(e.target.checked)}
                    />
                    <span className="text-sm">保存到库（save=1）</span>
                </label>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={diag}
                        onChange={(e) => setDiag(e.target.checked)}
                    />
                    <span className="text-sm">诊断信息（diag=1）</span>
                </label>
            </div>

            {propertyId && (
                <div className="text-sm text-gray-700">
                    当前 propertyId: <span className="font-mono">{propertyId}</span>
                </div>
            )}
            {apiParamsEcho && (
                <div className="text-xs text-gray-500">
                    回显参数：{apiParamsEcho.level} | {apiParamsEcho.start} → {apiParamsEcho.end} | 事件：
                    {Array.isArray(apiParamsEcho.filteredEvents)
                        ? apiParamsEcho.filteredEvents.join(', ')
                        : apiParamsEcho.filteredEvents}
                </div>
            )}

            {saveEcho && (
                <div className="text-xs">
                    保存：{saveEcho.attempted ? (saveEcho.ok ? `成功，写入/覆盖 ${saveEcho.count ?? 0} 行` : `失败：${saveEcho.reason}`) : '未尝试'}
                </div>
            )}

            {loading && <div>加载中…</div>}
            {err && <div className="text-red-600">错误：{err}</div>}

            {debug && (
                <pre className="bg-gray-100 p-3 text-xs overflow-auto rounded">
{JSON.stringify(debug, null, 2)}
        </pre>
            )}

            {rows.length > 0 && (
                <table className="text-sm border w-full">
                    <thead>
                    <tr>
                        <th className="border px-2 py-1 text-left">date</th>
                        <th className="border px-2 py-1 text-left">geo</th>
                        <th className="border px-2 py-1 text-left">eventName</th>
                        <th className="border px-2 py-1 text-right">eventCount</th>
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map((r, i) => (
                        <tr key={i}>
                            <td className="border px-2 py-1">{r.date}</td>
                            <td className="border px-2 py-1">{r.geo}</td>
                            <td className="border px-2 py-1">{r.eventName}</td>
                            <td className="border px-2 py-1 text-right">{r.eventCount}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}

            {!loading && !err && propertyId && rows.length === 0 && (
                <div className="text-gray-500">暂无数据</div>
            )}
        </div>
    );
}
