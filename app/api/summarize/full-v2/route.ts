import { NextRequest, NextResponse } from 'next/server';
import { geminiModel } from '@/lib/gemini';
import { FullSummaryV2, ProfessorEmphasis } from '@/types/fullSummaryV2';

export const runtime = 'nodejs';

/**
 * 더미 교수님 강조 포인트 생성 (토픽 제목 기반)
 * 실제 음성 녹음 데이터가 없을 때 사용되는 더미 데이터
 */
function generateDummyProfessorEmphasis(topicTitle: string): ProfessorEmphasis[] {
  // 토픽 제목에 따라 관련된 더미 데이터 생성
  const dummyData: Record<string, ProfessorEmphasis[]> = {
    '정보의 표현 및 처리': [
      {
        point: '**바이트와 비트의 관계:**',
        context: '바이트는 8비트로 구성되며, 컴퓨터에서 데이터를 표현하는 기본 단위입니다. 마치 영어에서 알파벳(비트)이 모여 단어(바이트)가 되는 것과 같습니다.'
      },
      {
        point: '**워드 길이의 중요성:**',
        context: '32비트와 64비트 시스템의 차이는 메모리 주소 공간과 처리 능력에 직접적인 영향을 미칩니다. 시험에서는 각 시스템의 표현 범위를 정확히 구분할 수 있어야 합니다.'
      }
    ],
    '정수의 표현': [
      {
        point: '**부호 있는 정수와 부호 없는 정수:**',
        context: '부호 있는 정수는 음수와 양수를 모두 표현할 수 있지만, 부호 없는 정수는 0 이상의 값만 표현합니다. 표현 범위가 다르므로 계산 시 주의가 필요합니다.'
      },
      {
        point: '**오버플로우와 언더플로우:**',
        context: '정수 연산 시 표현 범위를 초과하면 오버플로우가 발생합니다. 이는 예상치 못한 결과를 초래할 수 있으므로, 프로그래밍 시 항상 고려해야 합니다.'
      }
    ],
    '프로그래밍': [
      {
        point: '**핵심 문법과 개념:**',
        context: '이 부분은 실제 코딩에서 자주 사용되므로 반드시 이해하고 암기해야 합니다. 특히 문법 오류가 발생하기 쉬운 부분을 주의깊게 봐야 합니다.'
      },
      {
        point: '**실무 적용 시 주의사항:**',
        context: '이론과 실제 적용 시 차이점이 있을 수 있습니다. 예제 코드를 직접 실행해보면서 이해하는 것이 중요합니다.'
      }
    ],
    '알고리즘': [
      {
        point: '**시간 복잡도와 공간 복잡도:**',
        context: '알고리즘의 효율성을 평가할 때 시간 복잡도와 공간 복잡도를 함께 고려해야 합니다. 시험에서는 특정 알고리즘의 복잡도를 묻는 문제가 자주 출제됩니다.'
      },
      {
        point: '**적용 사례:**',
        context: '이 알고리즘은 실제로 어떤 문제 해결에 사용되는지 이해하는 것이 중요합니다. 문제 유형을 파악하고 적절한 알고리즘을 선택할 수 있어야 합니다.'
      }
    ]
  };

  // 토픽 제목과 일치하는 더미 데이터가 있으면 사용
  for (const [key, value] of Object.entries(dummyData)) {
    if (topicTitle.includes(key)) {
      return value;
    }
  }

  // 키워드 기반 매칭 (부분 일치)
  const keywords: Record<string, ProfessorEmphasis[]> = {
    '표현': [
      {
        point: '**데이터 표현 방식:**',
        context: '컴퓨터에서 데이터를 어떻게 표현하는지 이해하는 것이 중요합니다. 특히 이진법과 십진법 변환은 기본적으로 알아야 합니다.'
      },
      {
        point: '**표현 범위와 제한사항:**',
        context: '각 데이터 타입이 표현할 수 있는 범위를 정확히 알고 있어야 합니다. 범위를 초과하면 예상치 못한 결과가 발생할 수 있습니다.'
      }
    ],
    '구조': [
      {
        point: '**구조의 핵심 원리:**',
        context: '이 구조는 데이터를 효율적으로 저장하고 접근하기 위한 방법입니다. 각 요소의 역할과 관계를 명확히 이해해야 합니다.'
      },
      {
        point: '**실제 활용 예시:**',
        context: '이 구조는 실제 프로그래밍에서 어떻게 사용되는지 예제를 통해 학습하는 것이 좋습니다. 이론만으로는 이해하기 어려울 수 있습니다.'
      }
    ],
    '함수': [
      {
        point: '**함수의 역할과 중요성:**',
        context: '함수는 코드의 재사용성과 가독성을 높이는 핵심 요소입니다. 특히 매개변수와 반환값의 관계를 정확히 이해해야 합니다.'
      },
      {
        point: '**호출 시 주의사항:**',
        context: '함수를 호출할 때 전달하는 인자의 타입과 개수를 정확히 맞춰야 합니다. 잘못된 호출은 오류를 발생시킬 수 있습니다.'
      }
    ]
  };

  for (const [keyword, value] of Object.entries(keywords)) {
    if (topicTitle.includes(keyword)) {
      return value;
    }
  }

  // 기본 더미 데이터 (토픽 제목과 관련된 일반적인 강조 포인트)
  return [
    {
      point: `**${topicTitle} 핵심 개념:**`,
      context: '이 주제는 시험에서 자주 출제되는 부분입니다. 특히 정의와 적용 사례를 명확히 구분할 수 있어야 합니다.'
    },
    {
      point: '**주의해야 할 점:**',
      context: '이 개념은 다른 유사한 개념과 혼동하기 쉬우므로, 차이점을 명확히 이해하는 것이 중요합니다. 실제 예제를 통해 확인해보는 것을 권장합니다.'
    }
  ];
}

const FULL_SUMMARY_V2_PROMPT = `
너는 대학 강의를 시험 대비용으로 정리하는 조교다.
단, 결과물은 "정리된 필기 노트"처럼 보여야 하며,
요약본만 읽어도 개념의 흐름이 자연스럽게 이해되어야 한다.

입력은 PDF 슬라이드에서 추출한 텍스트(PDF_TEXT)다.

⚠️ 핵심 목표:
- 억지로 구조를 드러내지 말 것
- 목차처럼 보이지 않게 정리할 것
- 쭉 읽으면 이해가 이어지는 필기 노트 형태를 만들 것

지시사항:
- 결과는 시험 대비용 "전체 요약"
- 반드시 지정된 JSON 구조로만 출력
- Markdown, 설명, 인삿말, 코드블록 출력 금지
- JSON만 출력

────────────────
[1] overview 작성 규칙
────────────────
- course_topic:
  강의 전체가 다루는 핵심 주제를
  시험 과목 소개 문단처럼 2~4문장으로 서술

- summary:
  문서 전체의 흐름, 핵심 개념, 중요 포인트를
  줄글 형태로 3~5문장 작성
  (나열식, 항목식 금지)

────────────────
[2] topics 작성 규칙 (가장 중요)
────────────────
- PDF_TEXT의 흐름을 존중하여 자연스럽게 topic을 나눈다
- topic_title은 질문형 또는 명확한 주장형 제목을 사용한다
  (억지 소단원 제목 생성 금지)

slide_notes 작성 규칙:
- slide_notes는 "설명 문장들의 흐름"이다
- 각 bullet은 하나의 완전한 설명 문장이다
- 문장 개수에는 제한을 두지 않는다
- bullet은 나열이 아니라, 위에서 아래로 읽으면 이해가 이어져야 한다
- 중간에 결론성 문장이나 강조 문장이 자연스럽게 포함될 수 있다
- 형식적인 Why / How / 주의 / 정리 같은 고정 구조를 만들지 않는다
- 쉬운 설명 박스, 요약 박스, 인위적인 섹션 구분을 사용하지 않는다

예시 사용 규칙:
- 표, 코드, 비교 예시는 개념 이해에 필요할 때만 포함한다
- 예시는 필수 요소가 아니다
- 예시가 포함될 경우, 장황한 설명 없이 시각적으로만 제시한다

professor_emphasis 작성 규칙:
- 각 topic마다 "교수님 강조 포인트" 토글 하나만 사용한다
- 시험에 나올 법한 강조, 헷갈리기 쉬운 포인트,
  교수님이 말로 덧붙였을 법한 설명을 담는다
- 현재 음성 데이터가 없으므로, 자연스러운 더미 데이터로 채운다

────────────────
[3] final_exam_takeaways 작성 규칙
────────────────
- 3~5문장 이내
- 시험 직전에 다시 읽을 핵심 판단 기준 위주로 작성
- 단순 요약이나 반복 설명 금지

────────────────
반드시 아래 JSON 구조를 그대로 따를 것:

{
  "document_title": "",
  "overview": {
    "course_topic": "",
    "summary": ""
  },
  "summary_type": "exam_notes",
  "topics": [
    {
      "topic_title": "",
      "slide_notes": [""],
      "professor_emphasis": [
        {
          "point": "",
          "context": ""
        }
      ]
    }
  ],
  "final_exam_takeaways": [""],
  "meta": {
    "source": {
      "pdf_used": true,
      "professor_speech_used": false
    },
    "generated_at": ""
  }
}

PDF_TEXT:
{{PDF_TEXT}}
`;

export async function POST(request: NextRequest) {
  try {
    const { pdfText, professorSpeechText } = await request.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY가 설정되어 있지 않습니다. (.env.local 확인)' },
        { status: 500 }
      );
    }

    if (!pdfText || typeof pdfText !== 'string' || pdfText.trim().length === 0) {
      return NextResponse.json(
        { error: 'pdfText가 비어있습니다.' },
        { status: 400 }
      );
    }

    // 프롬프트 구성: {{PDF_TEXT}} 플레이스홀더를 실제 PDF 텍스트로 치환
    let fullPrompt = FULL_SUMMARY_V2_PROMPT.replace('{{PDF_TEXT}}', pdfText);

    // 교수님 강조 포인트 추가 (실제 음성 데이터가 있을 때만)
    if (professorSpeechText && professorSpeechText.trim().length > 0) {
      fullPrompt += '\n\n교수님 강조 포인트:\n' + professorSpeechText;
    }

    // Gemini API 호출 (최대 2회 시도)
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < 2) {
      try {
        const result = await geminiModel.generateContent([fullPrompt]);
        const response = await result.response;
        const text = response.text();

        // JSON 부분만 추출
        let jsonText = text.trim();
        
        // 마크다운 코드 블록 제거
        jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // JSON 객체 찾기
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('JSON 형식을 찾을 수 없습니다.');
        }

        const summaryJson: FullSummaryV2 = JSON.parse(jsonMatch[0]);

        // 타입 검증
        if (!summaryJson.document_title || !summaryJson.overview || !summaryJson.topics) {
          throw new Error('필수 필드가 누락되었습니다.');
        }

        // meta 필드 설정 (이미 LLM이 생성했을 수 있지만, 서버에서 확실히 설정)
        summaryJson.meta = {
          source: {
            pdf_used: true,
            professor_speech_used: !!(professorSpeechText && professorSpeechText.trim().length > 0),
          },
          generated_at: new Date().toISOString(),
        };
        
        // 더미 데이터 생성: 각 토픽에 대해 교수님 강조 포인트 더미 데이터 추가
        // 실제 음성 데이터가 없을 때만 더미 데이터 생성
        if (!professorSpeechText || professorSpeechText.trim().length === 0) {
          summaryJson.topics = summaryJson.topics.map((topic: any) => {
            // 이미 professor_emphasis가 있고 내용이 있으면 유지, 없으면 더미 생성
            if (!topic.professor_emphasis || topic.professor_emphasis.length === 0) {
              topic.professor_emphasis = generateDummyProfessorEmphasis(topic.topic_title);
            }
            return topic;
          });
        }

        return NextResponse.json({
          success: true,
          summary: summaryJson,
        });
      } catch (error: any) {
        lastError = error;
        attempts++;

        if (attempts < 2) {
          // 재시도 시 JSON만 반환하도록 더 강하게 요청
          fullPrompt = FULL_SUMMARY_V2_PROMPT.replace('{{PDF_TEXT}}', pdfText);
          if (professorSpeechText && professorSpeechText.trim().length > 0) {
            fullPrompt += '\n\n교수님 강조 포인트:\n' + professorSpeechText;
          }
          fullPrompt += '\n\n[재시도] 반드시 JSON만 반환하세요. Markdown, 설명, 인삿말, 코드블록 출력 금지. JSON만 출력.';
        }
      }
    }

    // 모든 시도 실패
    throw lastError || new Error('JSON 파싱에 실패했습니다.');
  } catch (error: any) {
    console.error('전체 요약 v2 오류:', error);
    return NextResponse.json(
      { error: '전체 요약에 실패했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
