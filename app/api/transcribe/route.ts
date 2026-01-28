import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { readFile } from 'fs/promises';

export const runtime = 'nodejs';

function mimeFromPath(p: string) {
  const lower = p.toLowerCase();
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  return 'audio/webm';
}

async function fetchWithTimeout(input: RequestInfo, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { storagePath, language: languageFromBody } = await request.json();
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';
    const language = languageFromBody || process.env.OPENAI_TRANSCRIBE_LANGUAGE; // optional, e.g. "ko"

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY가 설정되어 있지 않습니다. (.env.local 확인)' },
        { status: 500 }
      );
    }

    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath가 필요합니다.' }, { status: 400 });
    }

    const normalized = typeof storagePath === 'string' && storagePath.startsWith('/')
      ? storagePath.slice(1)
      : storagePath;

    const audioPath = join(process.cwd(), 'public', normalized);
    const buf = await readFile(audioPath);

    const form = new FormData();
    form.append('model', model);
    if (language && language !== 'auto') form.append('language', language);
    form.append('file', new Blob([buf], { type: mimeFromPath(storagePath) }), normalized.split('/').pop() || 'audio.webm');

    const url = 'https://api.openai.com/v1/audio/transcriptions';
    const init: RequestInit = {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    };

    // OpenAI 전사는 길이에 따라 수 분 이상 걸릴 수 있어 타임아웃/재시도를 둠
    const timeoutMs = Number(process.env.OPENAI_TRANSCRIBE_TIMEOUT_MS || 240_000); // default 4min
    let res: Response;
    try {
      res = await fetchWithTimeout(url, init, timeoutMs);
    } catch (e: any) {
      // 한번 재시도 (일시적 네트워크/헤더 타임아웃 대응)
      try {
        res = await fetchWithTimeout(url, init, timeoutMs);
      } catch (e2: any) {
        const msg = e2?.name === 'AbortError'
          ? `OpenAI 전사 요청이 시간 초과되었습니다. (timeout ${timeoutMs}ms)`
          : (e2?.message || String(e2));
        return NextResponse.json(
          {
            error: '음성 텍스트 변환에 실패했습니다.',
            details: msg,
            hint: '녹음 길이를 줄이거나(예: 5~15분 단위), 다시 시도해 주세요.',
          },
          { status: 504 }
        );
      }
    }

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: '음성 텍스트 변환에 실패했습니다.', details: text },
        { status: res.status }
      );
    }

    const json = JSON.parse(text);
    return NextResponse.json({ success: true, text: json.text || '' });
  } catch (e: any) {
    console.error('Transcribe error:', e);
    return NextResponse.json(
      { error: '음성 텍스트 변환에 실패했습니다.', details: e?.message || String(e) },
      { status: 500 }
    );
  }
}


