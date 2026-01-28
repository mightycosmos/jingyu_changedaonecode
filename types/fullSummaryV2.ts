/**
 * Aone Full Summary v2 JSON 구조 타입 정의
 */

export interface FullSummaryV2 {
  document_title: string;
  overview: {
    course_topic: string;
    summary: string;
  };
  summary_type: "exam_notes";
  topics: Topic[];
  final_exam_takeaways: string[];
  meta: {
    source: {
      pdf_used: boolean;
      professor_speech_used: boolean;
    };
    generated_at: string;
  };
}

export interface Topic {
  topic_title: string;
  slide_notes: string[];
  professor_emphasis: ProfessorEmphasis[];
}

export interface ProfessorEmphasis {
  point: string;
  context: string;
}
