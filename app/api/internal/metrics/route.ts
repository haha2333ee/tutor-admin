// app/api/internal/metrics/route.ts
import { NextResponse } from 'next/server';
import dns from 'node:dns/promises';

export const runtime = 'nodejs';

function toBasic(user: string, pass: string) {
    return 'Basic ' + Buffer.from(`${(user||'').trim()}:${(pass||'').trim()}`).toString('base64');
}

function previewPromText(text: string, maxLines = 120) {
    const lines = text.split('\n');
    const kept = lines.filter(l => l && !l.startsWith('# HELP') && !l.startsWith('# TYPE'));
    return kept.slice(0, maxLines).join('\n');
}

async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
    const { timeoutMs = 8000, ...rest } = init;
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        return await fetch(url, { ...rest, signal: ctrl.signal, cache: 'no-store', redirect: 'follow' });
    } finally {
        clearTimeout(id);
    }
}

export async function GET() {
    const url  = process.env.SUPABASE_METRICS_URL;
    const user = process.env.SUPABASE_METRICS_USER || 'service_role';
    const pass = process.env.SUPABASE_METRICS_PASSWORD;

    if (!url || !pass) {
        return NextResponse.json(
            { error: 'Metrics not configured', diag: { hasUrl: !!url, hasPassword: !!pass } },
            { status: 500 }
        );
    }

    // 额外：DNS 诊断
    let dnsDiag: any = null;
    try {
        const { hostname } = new URL(url);
        const addrs = await dns.lookup(hostname, { all: true });
        dnsDiag = { hostname, addrs };
    } catch (e: any) {
        dnsDiag = { dnsError: e?.message || String(e) };
    }

    const headers = { Authorization: toBasic(user, pass), Accept: 'text/plain' };

    try {
        const res = await fetchWithTimeout(url, { headers, timeoutMs: 8000 });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            return NextResponse.json(
                { error: `Upstream ${res.status}`, detail: body.slice(0, 600), dns: dnsDiag },
                { status: 502 }
            );
        }
        const text = await res.text();
        return NextResponse.json({
            preview: previewPromText(text),
            rawLen: text.length,
            dns: dnsDiag
        });
    } catch (e: any) {
        // 关键：把 cause 也打出来（undici 一般把底层错误放在 cause 里）
        const diag = {
            name: e?.name,
            message: e?.message,
            code: e?.code,
            cause: {
                name: e?.cause?.name,
                code: e?.cause?.code,
                errno: e?.cause?.errno,
                syscall: e?.cause?.syscall,
                address: e?.cause?.address,
                port: e?.cause?.port,
                message: e?.cause?.message,
            },
            dns: dnsDiag,
            proxyEnv: {
                HTTPS_PROXY: process.env.HTTPS_PROXY || process.env.https_proxy || null,
                HTTP_PROXY: process.env.HTTP_PROXY || process.env.http_proxy || null,
                NO_PROXY: process.env.NO_PROXY || process.env.no_proxy || null,
            }
        };
        console.error('metrics fetch error', diag);
        return NextResponse.json({ error: 'Fetch metrics failed', diag }, { status: 500 });
    }
}
