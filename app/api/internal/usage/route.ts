// app/api/internal/usage/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE = "https://api.supabase.com/v1";
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;

function buildMgmtHeaders(): Record<string, string> {
    if (!TOKEN) throw new Error("Missing mgmt token");
    return {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
    };
}

async function fetchWithTimeout(
    input: RequestInfo | URL,
    init: (RequestInit & { timeoutMs?: number }) | undefined = {}
) {
    const { timeoutMs = 15000, ...rest } = init ?? {};
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, { ...rest, signal: controller.signal });
    } finally {
        clearTimeout(t);
    }
}

export async function GET(req: NextRequest) {
    if (!TOKEN || !REF) {
        return NextResponse.json(
            { error: "Missing mgmt token or project ref" },
            { status: 500 }
        );
    }

    try {
        const params = new URL(req.url).searchParams;
        // 可选：period（如 1h/24h/7d 等，按你的实际端点要求传）
        const period = params.get("period") ?? "24h";

        const qs = new URLSearchParams({ period });

        // 示例两个端点（按你的需求调整路径）：
        const apiCountsURL = `${BASE}/projects/${REF}/analytics/endpoints/api.all?${qs}`;
        const reqCountsURL = `${BASE}/projects/${REF}/analytics/endpoints/requests.all?${qs}`;

        const headers = buildMgmtHeaders();

        const [r1, r2] = await Promise.all([
            fetchWithTimeout(apiCountsURL, { headers, timeoutMs: 15000 }),
            fetchWithTimeout(reqCountsURL, { headers, timeoutMs: 15000 }),
        ]);

        if (!r1.ok || !r2.ok) {
            const body1 = !r1.ok ? await r1.text().catch(() => "") : undefined;
            const body2 = !r2.ok ? await r2.text().catch(() => "") : undefined;
            return NextResponse.json(
                {
                    error: "management api error",
                    status1: r1.status,
                    status2: r2.status,
                    body1,
                    body2,
                },
                { status: 502 }
            );
        }

        const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
        return NextResponse.json(
            {
                period,
                api: d1,       // 第一个端点的原始返回
                requests: d2,  // 第二个端点的原始返回
            },
            { status: 200 }
        );
    } catch (e: any) {
        return NextResponse.json(
            { error: "fetch failed", detail: e?.message ?? String(e) },
            { status: 500 }
        );
    }
}
