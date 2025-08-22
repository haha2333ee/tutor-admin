// app/api/ga/report/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FN_URL = 'https://kaaumjnobrgnotcaskrw.supabase.co/functions/v1/ga-report';

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const qs = url.searchParams.toString();

        const auth = req.headers.get('authorization');
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized: missing Authorization header' }, { status: 401 });
        }

        const edgeRes = await fetch(`${FN_URL}?${qs}`, {
            method: 'GET',
            headers: { Authorization: auth },
        });

        const contentType = edgeRes.headers.get('content-type') || '';
        const text = await edgeRes.text();

        if (!edgeRes.ok) {
            return NextResponse.json(
                { error: 'Edge function error', status: edgeRes.status, contentType, body: text },
                { status: edgeRes.status }
            );
        }

        try {
            const json = JSON.parse(text);
            return NextResponse.json(json, { status: edgeRes.status });
        } catch {
            return new NextResponse(text, { status: edgeRes.status, headers: { 'Content-Type': contentType || 'text/plain' } });
        }
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
    }
}
