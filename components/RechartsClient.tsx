"use client";

import React from "react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Legend, Cell,
} from "recharts";

/** 折线图（趋势） */
export function TrendChart({ data }: { data: { date: string; events: number }[] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 10, right: 20, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="events" stroke="#8884d8" strokeWidth={2} dot={false} />
            </LineChart>
        </ResponsiveContainer>
    );
}

/** 条形图（Top 地区/站点） */
export function TopGeoChart({ data }: { data: { label: string; events: number }[] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="label" width={160} />
                <Tooltip formatter={(v: any) => new Intl.NumberFormat().format(v as number)} />
                <Bar dataKey="events" radius={[4, 4, 0, 0]} fill="#82ca9d" />
            </BarChart>
        </ResponsiveContainer>
    );
}

/** 饼图（事件构成） */
export function MixPieChart({ data }: { data: { name: string; value: number }[] }) {
    const colors = ["#8884d8", "#82ca9d", "#ffc658", "#8dd1e1", "#a4de6c", "#d0ed57", "#a28cf0", "#f6a5c0"];
    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Tooltip formatter={(v: any) => new Intl.NumberFormat().format(v as number)} />
                <Legend />
                <Pie data={data} dataKey="value" nameKey="name" outerRadius={120} label>
                    {data.map((_, i) => (
                        <Cell key={`cell-${i}`} fill={colors[i % colors.length]} />
                    ))}
                </Pie>
            </PieChart>
        </ResponsiveContainer>
    );
}

/** 堆叠柱（Top4 + 其他） */
export function MixStackChart({ data }: { data: Array<Record<string, number | string>> }) {
    const colors = ["#8884d8", "#82ca9d", "#ffc658", "#8dd1e1", "#a4de6c", "#d0ed57", "#a28cf0", "#f6a5c0"];
    const keys = data.length ? Object.keys(data[0]).filter(k => k !== "date") : [];
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                {keys.map((k, idx) => (
                    <Bar key={k} dataKey={k} stackId="a" fill={colors[idx % colors.length]} />
                ))}
            </BarChart>
        </ResponsiveContainer>
    );
}
