// app/api/internal/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // 明确用 Node 运行时，避免边缘环境差异

const BASE = "https://api.supabase.com/v1";
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;

// ——注意：不要让“返回响应对象”的函数被当成 headers 使用——
// 直接在处理函数里判断环境变量，构造纯 headers 对象即可。

// 简单的可选查询模板（不要把用户输入直接拼到 SQL）
const QUERIES: Record<string, string> = {
    // 过去1小时每分钟 API 边缘请求数（edge_logs）
    "edge-req-per-minute": `
        SELECT
            timestamp_trunc(t.timestamp, minute) AS ts,
            count(*) AS count
        FROM edge_logs t
        WHERE t.timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 60 minute)
        GROUP BY ts
        ORDER BY ts ASC
    `,
    // 最近100条 5xx
    "edge-5xx-latest": `
        SELECT
            t.timestamp, event_message
        FROM edge_logs t
                 CROSS JOIN UNNEST(metadata) m
                 CROSS JOIN UNNEST(m.response) r
        WHERE r.status_code >= 500
        ORDER BY t.timestamp DESC
            LIMIT 100
    `,
};

export async function GET(req: NextRequest) {
    if (!TOKEN || !REF) {
        return NextResponse.json(
            { error: "Missing mgmt token or project ref" },
            { status: 500 }
        );
    }

    try {
        const u = new URL(req.url);
        const kind = u.searchParams.get("kind") ?? "edge-req-per-minute";

        const sql = QUERIES[kind];
        if (!sql) {
            return NextResponse.json({ error: "invalid kind" }, { status: 400 });
        }

        // 支持自定义时间窗（遵循官方限制：未传则默认近1分钟；传 start/end 上限24h）
        const isoStart = u.searchParams.get("iso_start") ?? undefined;
        const isoEnd = u.searchParams.get("iso_end") ?? undefined;

        const qs = new URLSearchParams();
        qs.set("sql", sql);
        if (isoStart) qs.set("iso_timestamp_start", isoStart);
        if (isoEnd) qs.set("iso_timestamp_end", isoEnd);

        const url = `${BASE}/projects/${REF}/analytics/endpoints/logs.all?${qs.toString()}`;

        // 这里 headers 必须是纯 HeadersInit
        const r = await fetch(url, {
            headers: { Authorization: `Bearer ${TOKEN}` },
        });

        if (!r.ok) {
            const body = await r.text().catch(() => "");
            return NextResponse.json(
                { error: "management api error", status: r.status, body },
                { status: 502 }
            );
        }

        // 结果既可能是 JSON 也可能是纯文本，这里做兼容处理
        const text = await r.text();
        const ct = r.headers.get("content-type") || "";
        try {
            const data = JSON.parse(text);
            // 返回原始结果（data.rows / data.columns 等），前端根据需要处理
            return NextResponse.json({ kind, data }, { status: 200 });
        } catch {
            // 非 JSON 则原样返回
            return new NextResponse(text, {
                status: 200,
                headers: { "Content-Type": ct || "text/plain" },
            });
        }
    } catch (e: any) {
        return NextResponse.json(
            { error: "fetch failed", detail: e?.message ?? String(e) },
            { status: 500 }
        );
    }
}
