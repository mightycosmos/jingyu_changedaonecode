"use client";

import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, BookOpen, FileText } from "lucide-react";
import { generateFullSummaryV2, fetchFullSummaryV2 } from "@/lib/fullSummaryV2";
import { FullSummaryV2, Topic } from "@/types/fullSummaryV2";
import { getFileUrl, fetchFiles, FileMetadata } from "@/lib/files";
import { getCurrentUser } from "@/lib/auth";

interface FullSummaryViewV2Props {
  documentId: string;
  storagePath?: string;
}

export default function FullSummaryViewV2({ documentId, storagePath }: FullSummaryViewV2Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [fullSummary, setFullSummary] = useState<FullSummaryV2 | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set());
  const [fileData, setFileData] = useState<FileMetadata | null>(null);

  useEffect(() => {
    loadStoredSummary();
    loadFileData();
  }, [documentId]);

  const loadStoredSummary = async () => {
    try {
      const stored = await fetchFullSummaryV2(documentId);
      if (stored) {
        setFullSummary(stored);
        // 모든 토픽의 professor_emphasis를 기본적으로 접힌 상태로
        const topicsWithEmphasis = stored.topics
          .map((_, idx) => (stored.topics[idx].professor_emphasis.length > 0 ? idx : -1))
          .filter(idx => idx >= 0);
        // 처음에는 모두 접힌 상태
      }
    } catch (error) {
      console.error('전체 요약 로드 실패:', error);
    }
  };

  const loadFileData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const files = await fetchFiles(user.id);
      const file = files.find(f => f.id === documentId);
      if (file) {
        setFileData(file);
      }
    } catch (err) {
      console.error("파일 데이터 로드 실패:", err);
    }
  };

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      const result = await generateFullSummaryV2(documentId, {
        storagePath: storagePath || fileData?.storage_path,
      });
      
      setFullSummary(result);
    } catch (err: any) {
      console.error("전체 요약 실패:", err);
      alert(err.message || "전체 요약에 실패했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleTopicEmphasis = (topicIndex: number) => {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topicIndex)) {
        next.delete(topicIndex);
      } else {
        next.add(topicIndex);
      }
      return next;
    });
  };

  if (!fullSummary && !isGenerating) {
    return (
      <div className="h-full flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-white mb-3">
            전체 요약을 생성해보세요
          </h3>
          <p className="text-text-secondary mb-6 leading-relaxed">
            PDF 텍스트를 분석하여 시험 대비에 최적화된 전체 요약을 생성합니다.
            <br />
            <span className="text-xs text-text-secondary/70">각 주제별 교수님 강조 포인트가 자동으로 포함됩니다.</span>
          </p>

          <button
            onClick={handleGenerateSummary}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium inline-flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            전체요약하기
          </button>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">전체 요약을 생성하고 있습니다...</p>
          <p className="text-sm text-text-secondary mt-2">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  if (!fullSummary) {
    return null;
  }

  return (
    <div className="h-full overflow-y-auto bg-white">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 p-6 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">전체 요약</h2>
            </div>
          </div>
          <button
            onClick={handleGenerateSummary}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
            다시 생성
          </button>
        </div>
      </div>

      {/* 요약 내용 */}
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        {/* 제목 */}
        <h1 className="text-4xl font-bold text-gray-900 mb-6">요약</h1>

        {/* Overview - 서술형 문단 */}
        <div className="space-y-4 mb-8">
          <p className="text-gray-900 leading-relaxed text-base whitespace-pre-line">
            {fullSummary.overview.summary}
          </p>
        </div>

        {/* Topics 섹션 */}
        <div className="space-y-8">
          {fullSummary.topics.map((topic: Topic, topicIndex: number) => (
            <div key={topicIndex} className="space-y-4">
              {/* Topic Title - 큰 섹션 제목 */}
              <h2 className="text-2xl font-bold text-gray-900">{topic.topic_title}</h2>

              {/* Slide Notes - 서술형 문장들 */}
              <div className="space-y-3">
                {topic.slide_notes.map((note, noteIndex) => {
                  // **키워드:** 형식 파싱
                  const boldMatch = note.match(/^\*\*(.+?):\*\*(.+)$/);
                  if (boldMatch) {
                    const [, keyword, content] = boldMatch;
                    return (
                      <div key={noteIndex} className="text-gray-900 text-base leading-relaxed">
                        <span className="font-semibold text-blue-600">{keyword}:</span>
                        <span>{content}</span>
                      </div>
                    );
                  }
                  // 일반 문장
                  return (
                    <div key={noteIndex} className="text-gray-900 text-base leading-relaxed">
                      {note}
                    </div>
                  );
                })}
              </div>

              {/* Professor Emphasis (교수님 강조 포인트 토글) */}
              {topic.professor_emphasis.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => toggleTopicEmphasis(topicIndex)}
                    className="w-full flex items-center justify-start text-left hover:bg-gray-50 rounded-lg p-2 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-gray-200 rounded flex items-center justify-center">
                        <span className="text-gray-600 text-xs">📌</span>
                      </div>
                      <span className="text-sm text-gray-600 font-medium">교수님 강조 포인트</span>
                      <ChevronDown 
                        className={`w-4 h-4 text-gray-400 transition-transform ${
                          expandedTopics.has(topicIndex) ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {expandedTopics.has(topicIndex) && (
                    <div className="mt-3 space-y-3 pl-7">
                      {topic.professor_emphasis.map((emphasis, empIndex) => (
                        <div key={empIndex} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          {emphasis.point && (
                            <div className="flex items-start gap-2 mb-2">
                              <span className="text-gray-500 text-xs mt-0.5">🔍</span>
                              <p className="text-gray-900 text-sm font-semibold leading-relaxed">{emphasis.point}</p>
                            </div>
                          )}
                          {emphasis.context && (
                            <p className="text-gray-700 text-sm leading-relaxed pl-5">{emphasis.context}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Final Exam Takeaways */}
        {fullSummary.final_exam_takeaways.length > 0 && (
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">시험 대비 핵심 포인트</h2>
            <div className="space-y-3">
              {fullSummary.final_exam_takeaways.map((takeaway, index) => (
                <div key={index} className="text-gray-900 text-base leading-relaxed">
                  {takeaway}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meta 정보 */}
        <div className="text-xs text-gray-500 text-center pt-4 border-t border-gray-200 mt-8">
          <p>
            생성 시간: {new Date(fullSummary.meta.generated_at).toLocaleString('ko-KR')} | 
            PDF 사용: {fullSummary.meta.source.pdf_used ? '예' : '아니오'} | 
            교수님 음성 사용: {fullSummary.meta.source.professor_speech_used ? '예' : '아니오'}
          </p>
        </div>
      </div>
    </div>
  );
}
