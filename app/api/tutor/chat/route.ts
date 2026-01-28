import { NextRequest, NextResponse } from 'next/server';
import { geminiModel } from '@/lib/gemini';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되어 있지 않습니다.' }, { status: 500 });
    }

    const body = await req.json();
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = body?.messages || [];
    const contextText: string = body?.contextText || '';
    const documentId: string = body?.documentId || '';

    if (!messages.length) {
      return NextResponse.json({ error: 'messages가 비어 있습니다.' }, { status: 400 });
    }

    const historyParts = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const system = `너는 대학 강의 보조 AI 튜터다. 학생이 이해하기 쉽게 한국어로 짧고 명확하게 답해라. 모르면 솔직히 모른다고 말하고, 근거가 부족하면 추측하지 말아라.`;
    const contextPrefix = contextText
      ? `\n\n[문서 요약 컨텍스트]\n${contextText}\n\n컨텍스트를 우선 사용하되, 질문이 무관하면 일반 지식으로 간단히 답변.`
      : '';

    const result = await geminiModel.generateContent({
      systemInstruction: system,
      contents: [
        ...historyParts,
        {
          role: 'user',
          parts: [{ text: `문서 ID: ${documentId || '(unknown)'}${contextPrefix}` }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 2048,
      },
    } as any);

    const text = (await result.response).text();
    return NextResponse.json({ reply: text || '답변을 생성하지 못했어요.' });
  } catch (e: any) {
    console.error('AI tutor error:', e);
    return NextResponse.json(
      { error: 'AI 튜터 응답 생성에 실패했습니다.', details: e?.message || String(e) },
      { status: 500 }
    );
  }
}


