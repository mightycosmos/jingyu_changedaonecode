import { NextRequest, NextResponse } from 'next/server';
import { geminiModel } from '@/lib/gemini';
import { join } from 'path';
import { readFile, stat } from 'fs/promises';

export const runtime = 'nodejs';

const BULK_SLIDE_SUMMARY_PROMPT = `
당신은 최고의 강의 보조 AI입니다.
사용자가 업로드한 PDF 강의 슬라이드를 보고, 페이지(슬라이드)별로 핵심 내용을 요약해 주세요.

## 출력 규칙 (매우 중요)
- 반드시 JSON만 출력하세요. (마크다운/설명/백틱 금지)
- 최상위 키는 "summaries" 하나만 사용하세요.
- "summaries"는 배열이며, 각 원소는 아래 형태여야 합니다:
  {
    "slide_number": 1,
    "summary": { ... TipTap JSON ... }
  }
- TipTap JSON은 반드시 아래 구조를 따르세요:
  - 최상위: { "type": "doc", "content": [...] }
  - content에는 heading(level=3) 1개 + bulletList 1개를 기본으로 포함하세요.
- 가능한 한 모든 페이지를 포함하세요.

## TipTap JSON 예시 (참고)
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 3 }, "content": [{ "type": "text", "text": "슬라이드 제목" }] },
    {
      "type": "bulletList",
      "content": [
        { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "핵심 내용" }] }] }
      ]
    }
  ]
}
`;

export async function POST(request: NextRequest) {
  try {
    const { storagePath } = await request.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY가 설정되어 있지 않습니다. (.env.local 확인)' },
        { status: 500 }
      );
    }

    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath가 필요합니다.' }, { status: 400 });
    }

    // 실제 파일 시스템 경로로 변환 (storagePath: /uploads/...)
    const normalized = typeof storagePath === 'string' && storagePath.startsWith('/')
      ? storagePath.slice(1)
      : storagePath;
    const pdfPath = join(process.cwd(), 'public', normalized);
    let fileInfo: { size: number } | null = null;
    try {
      const s = await stat(pdfPath);
      fileInfo = { size: s.size };
    } catch {
      return NextResponse.json(
        { error: 'PDF 파일을 찾을 수 없습니다.', details: `경로 확인 필요: ${storagePath}` },
        { status: 404 }
      );
    }
    const pdfBuffer = await readFile(pdfPath);

    // Gemini inlineData는 base64 필요
    const base64Pdf = pdfBuffer.toString('base64');

    const result = await geminiModel.generateContent([
      BULK_SLIDE_SUMMARY_PROMPT,
      {
        inlineData: {
          data: base64Pdf,
          mimeType: 'application/pdf',
        },
      } as any,
    ]);

    const response = await result.response;
    const text = response.text();

    // JSON 부분만 추출 (혹시 모를 잡텍스트 대비)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!parsed?.summaries || !Array.isArray(parsed.summaries)) {
      return NextResponse.json(
        { error: 'Gemini가 유효한 summaries JSON을 반환하지 않았습니다.', details: text },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, summaries: parsed.summaries });
  } catch (error: any) {
    console.error('슬라이드 일괄 요약 오류:', error);
    return NextResponse.json(
      {
        error: '슬라이드 일괄 요약에 실패했습니다.',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}


