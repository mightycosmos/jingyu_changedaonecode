import { NextRequest, NextResponse } from 'next/server';
import { geminiModel } from '@/lib/gemini';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const { slidesText } = await request.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: 'GEMINI_API_KEY가 설정되어 있지 않습니다. (.env.local 확인)' },
                { status: 500 }
            );
        }

        if (!slidesText || typeof slidesText !== 'string' || slidesText.trim().length === 0) {
            return NextResponse.json(
                { error: 'slidesText가 비어있습니다. 먼저 슬라이드 요약을 생성해 주세요.' },
                { status: 400 }
            );
        }

        const FULL_SUMMARY_FROM_SLIDES_PROMPT = `
당신은 최고의 강의 보조 AI입니다.
아래에 제공되는 "슬라이드별 요약 텍스트"만을 근거로, 학생이 개념을 쉽게 이해할 수 있도록 전체 강의 내용을 한 번에 정리해 주세요.

## 요구사항
- 반드시 한국어로 작성
- 구조: (1) 핵심 개념 한눈에 보기 (키워드/정의) (2) 개념들 간 연결(흐름) (3) 시험/과제 대비 포인트 (4) 자주 헷갈리는 부분/주의점
- 근거 없는 내용 추가 금지 (슬라이드 요약 텍스트에서 유추 가능한 범위만)
- 결과는 반드시 TipTap JSON만 반환 (마크다운/설명/백틱 금지)

## TipTap JSON 형식 예시(참고)
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "전체 요약" }] },
    { "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }
  ]
}

슬라이드별 요약 텍스트:
`;

        // Gemini API 호출
        const result = await geminiModel.generateContent([
            FULL_SUMMARY_FROM_SLIDES_PROMPT,
            slidesText
        ]);

        const response = await result.response;
        const fullSummaryText = response.text();

        // JSON 부분만 추출
        const jsonMatch = fullSummaryText.match(/\{[\s\S]*\}/);
        const summaryJson = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

        if (!summaryJson) {
            throw new Error('Gemini가 유효한 JSON 형식을 반환하지 않았습니다.');
        }

        return NextResponse.json({
            success: true,
            summary: summaryJson,
        });
    } catch (error: any) {
        console.error('전체 요약 오류:', error);
        return NextResponse.json(
            { error: '전체 요약에 실패했습니다.', details: error.message },
            { status: 500 }
        );
    }
}
