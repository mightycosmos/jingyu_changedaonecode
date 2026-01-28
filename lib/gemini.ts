import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// 모델명은 .env.local의 GEMINI_MODEL로 오버라이드 가능 (기본: gemini-2.5-flash)
const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const geminiModel = genAI.getGenerativeModel({ model: modelName });

export const SLIDE_SUMMARY_PROMPT = `
당신은 최고의 강의 보조 AI입니다. 
제공된 슬라이드 텍스트를 분석하여 핵심 내용을 한 눈에 이해하기 쉽게 요약해 주세요.

## 규칙:
1. 중요한 개념, 키워드, 수식 등을 빠짐없이 포함하세요.
2. 불필요한 서술어는 줄이고 개조식(- 사용)으로 작성하세요.
3. 한국어로 작성하세요.
4. 결과물은 반드시 JSON 형식으로 반환해야 하며, TipTap 에디터에서 사용하는 JSON 구조를 따라야 합니다.

## TipTap JSON 예시:
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 3 },
      "content": [{ "type": "text", "text": "슬라이드 제목" }]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "핵심 내용 1" }] }]
        }
      ]
    }
  ]
}

슬라이드 텍스트:
`;

export const FULL_SUMMARY_PROMPT = `
당신은 복잡한 강의 내용을 유기적으로 연결하여 종합적인 서술형 요약을 작성하는 전문가입니다.
제공된 모든 슬라이드 요약 정보와 사용자가 직접 수정한 텍스트들을 종합하여, 전체 강의의 흐름을 꿰뚫는 '전체 요약'을 작성해 주세요.

## 요약 가이드라인:
1. **서론**: 본 강의의 전반적인 목적과 배경을 설명하세요.
2. **본론**: 주요 주제별로 섹션을 나누어 상세히 설명하세요. 슬라이드 간의 유기적인 연결 관계(원인-결과, 사례 등)를 강조하세요.
3. **결론**: 강의의 핵심 시사점이나 요약을 마무리하세요.
4. 예시에 나온 스타일을 참고하여 전문적이고 가독성 높게 작성하세요.
5. 결과물은 반드시 TipTap 에디터 JSON 형식을 따라야 합니다.

## 입력 데이터 (JSON):
`;
