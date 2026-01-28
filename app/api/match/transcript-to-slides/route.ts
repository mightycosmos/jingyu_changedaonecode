import { NextRequest, NextResponse } from 'next/server';
import { geminiModel } from '@/lib/gemini';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

const MATCH_PROMPT = `
당신은 강의 보조 AI입니다.
입력으로 (A) PDF 슬라이드 페이지별 텍스트(일부)와 (B) 교수님 설명 정리본이 주어집니다.
목표는 교수님 설명 정리본을 슬라이드별로 가장 자연스럽게 배치하는 것입니다.

## 출력 규칙
- 반드시 JSON만 출력 (마크다운/백틱/설명 금지)
- 최상위 키: "notes"
- notes는 배열이며 원소는 { "slide_number": number, "text": string } 형태
- text는 해당 슬라이드에서 교수님이 강조했을 법한 설명을 2~6줄로 정리 (불필요한 중복 제거)
- 입력에 근거 없는 내용 추가 금지

입력:
`;

export async function POST(request: NextRequest) {
  try {
    const { storagePath, notesText } = await request.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY가 설정되어 있지 않습니다. (.env.local 확인)' },
        { status: 500 }
      );
    }

    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath(PDF)가 필요합니다.' }, { status: 400 });
    }
    if (!notesText || typeof notesText !== 'string' || notesText.trim().length === 0) {
      return NextResponse.json({ error: 'notesText가 비어있습니다.' }, { status: 400 });
    }

    const normalized = typeof storagePath === 'string' && storagePath.startsWith('/')
      ? storagePath.slice(1)
      : storagePath;

    const pdfPath = join(process.cwd(), 'public', normalized);
    const scriptPath = join(process.cwd(), 'scripts', 'pdf_extract_pages.mjs');

    const { stdout } = await execFileAsync(
      process.execPath,
      [scriptPath, pdfPath],
      { maxBuffer: 50 * 1024 * 1024 }
    );

    const parsed = JSON.parse(stdout);
    const pages = Array.isArray(parsed?.pages) ? parsed.pages : [];

    // 토큰 폭발 방지: 페이지당 앞부분만 사용
    const pageSnippets = pages.map((p: any) => {
      const num = Number(p.slide_number);
      const t = String(p.text || '').slice(0, 800);
      return { slide_number: num, text: t };
    });

    const input = JSON.stringify({ pages: pageSnippets, notesText }, null, 2);

    const result = await geminiModel.generateContent([MATCH_PROMPT, input]);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const out = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    const rawNotes = Array.isArray(out?.notes) ? out.notes : [];

    // Normalize output shape to { slide_number, text }
    const normalizedNotes = rawNotes
      .map((n: any) => {
        const slideNum = Number(n?.slide_number ?? n?.slideNumber);
        const t = String(n?.text ?? n?.notesText ?? '').trim();
        return { slide_number: slideNum, text: t };
      })
      .filter((n: any) => Number.isFinite(n.slide_number) && n.slide_number > 0 && n.text.length > 0);

    // Fallback: if model didn't return usable mapping, put whole notes into slide 1
    const fallbackNotes =
      normalizedNotes.length === 0
        ? [{ slide_number: 1, text: String(notesText || '').slice(0, 3000) }]
        : normalizedNotes;

    if (!fallbackNotes || fallbackNotes.length === 0) {
      return NextResponse.json(
        { error: 'Gemini가 유효한 notes JSON을 반환하지 않았습니다.', details: text },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      notes: fallbackNotes,
      fallbackUsed: normalizedNotes.length === 0,
    });
  } catch (e: any) {
    console.error('Match transcript to slides error:', e);
    return NextResponse.json(
      { error: '슬라이드 매칭에 실패했습니다.', details: e?.message || String(e) },
      { status: 500 }
    );
  }
}


