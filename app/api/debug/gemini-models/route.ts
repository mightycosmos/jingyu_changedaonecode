import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되어 있지 않습니다.' }, { status: 500 });
    }

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'ListModels 호출 실패', details: e?.message || String(e) }, { status: 500 });
  }
}


