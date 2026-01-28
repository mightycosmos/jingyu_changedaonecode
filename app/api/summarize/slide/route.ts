import { NextRequest, NextResponse } from 'next/server';
import { geminiModel, SLIDE_SUMMARY_PROMPT } from '@/lib/gemini';
import { join } from 'path';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const { storagePath, slideNumber, slideText } = await request.json();

        if (!slideNumber) {
            return NextResponse.json(
                { error: 'slideNumber가 필요합니다.' },
                { status: 400 }
            );
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: 'GEMINI_API_KEY가 설정되어 있지 않습니다. (.env.local 확인)' },
                { status: 500 }
            );
        }

        let text: string = '';
        if (typeof slideText === 'string' && slideText.trim().length > 0) {
            // 클라이언트에서 추출한 텍스트를 사용 (서버 PDF 파싱 회피)
            text = slideText;
        } else {
            if (!storagePath) {
                return NextResponse.json(
                    { error: 'slideText 또는 storagePath가 필요합니다.' },
                    { status: 400 }
                );
            }

            // 실제 파일 시스템 경로로 변환 (storagePath: /uploads/...)
            const pdfPath = join(process.cwd(), 'public', storagePath);

            // 텍스트 추출 (필요할 때만 동적 임포트)
            const { extractTextFromPdfPage } = await import('@/lib/pdf-helper');
            text = await extractTextFromPdfPage(pdfPath, slideNumber);
        }

        if (!text || text.trim().length === 0) {
            return NextResponse.json({
                success: true,
                summary: {
                    type: 'doc',
                    content: [
                        {
                            type: 'paragraph',
                            content: [{ type: 'text', text: '이 슬라이드에서 텍스트를 추출할 수 없습니다.' }]
                        }
                    ]
                }
            });
        }

        // Gemini API 호출
        const result = await geminiModel.generateContent([
            SLIDE_SUMMARY_PROMPT,
            text
        ]);

        const response = await result.response;
        const summaryText = response.text();

        // JSON 부분만 추출 (혹시 모를 마크다운 백틱 제거)
        const jsonMatch = summaryText.match(/\{[\s\S]*\}/);
        const summaryJson = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

        if (!summaryJson) {
            throw new Error('Gemini가 유효한 JSON 형식을 반환하지 않았습니다.');
        }

        return NextResponse.json({
            success: true,
            summary: summaryJson,
        });
    } catch (error: any) {
        console.error('슬라이드 요약 오류:', error);
        return NextResponse.json(
            { error: '슬라이드 요약에 실패했습니다.', details: error?.message || String(error) },
            { status: 500 }
        );
    }
}
