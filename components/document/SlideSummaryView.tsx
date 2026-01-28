"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronDown, ChevronUp, Play } from "lucide-react";
import TipTapEditor from "./TipTapEditor";
import { saveSlideSummary, fetchSlideSummaries, summarizeSlideWithAI, summarizeAllSlidesWithAI } from "@/lib/slideSummaries";
import { Sparkles } from "lucide-react";
import { fetchProfessorNotesMap, saveProfessorNotesForSlides } from "@/lib/recordings";

const MOCK_RECORDING_KEY = "aone_mock_recording_state";

const loadMockRecordingState = () => {
  if (typeof window === "undefined") return { active: false };
  try {
    const raw = localStorage.getItem(MOCK_RECORDING_KEY);
    if (!raw) return { active: false };
    const obj = JSON.parse(raw);
    return { active: !!obj?.active };
  } catch {
    return { active: false };
  }
};

interface SlideSummary {
  slideNumber: number;
  title: string;
  summaryContent: any; // TipTap JSON (AI 요약 + 사용자 편집 통합)
  audioSegments: any[];
}

interface SlideSummaryViewProps {
  documentId: string;
  slideSummaries: SlideSummary[];
  currentSlide: number;
  onSlideChange: (slide: number) => void;
  storagePath?: string;
}

export default function SlideSummaryView({
  documentId,
  slideSummaries,
  currentSlide,
  onSlideChange,
  storagePath,
}: SlideSummaryViewProps) {
  const [expandedAudio, setExpandedAudio] = useState<number | null>(null);
  const [summaries, setSummaries] = useState<SlideSummary[]>(slideSummaries);
  const [saving, setSaving] = useState<{ [key: number]: boolean }>({});
  const [isSummarizingAll, setIsSummarizingAll] = useState(false);
  const [profNotesBySlide, setProfNotesBySlide] = useState<Map<number, string>>(new Map());
  const [isRecordingBanner, setIsRecordingBanner] = useState(false);
  const saveTimeouts = useRef<{ [key: number]: NodeJS.Timeout }>({});
  const slideRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const lastDocumentIdRef = useRef<string | null>(null);

  // 부모에서 매 렌더마다 새로운 배열이 내려오는 구조라,
  // 여기서 무조건 setSummaries(slideSummaries)를 하면 AI 요약 결과가 즉시 덮어써집니다.
  // 대신:
  // - 문서가 바뀌면 초기화
  // - PDF 로드 후 페이지 수가 늘어 슬라이드 개수가 증가하면 "추가분만" 병합
  useEffect(() => {
    setSummaries((prev) => {
      // 문서 변경: 완전 초기화
      if (lastDocumentIdRef.current !== documentId) {
        lastDocumentIdRef.current = documentId;
        return slideSummaries;
      }

      // 슬라이드 개수 변경(대부분 PDF 로드 후 numPages 반영): 기존 요약을 유지하며 병합
      if (slideSummaries.length !== prev.length) {
        const prevByNum = new Map(prev.map((s) => [s.slideNumber, s]));
        return slideSummaries.map((s) => {
          const existing = prevByNum.get(s.slideNumber);
          if (!existing) return s;
          return {
            ...s,
            // 기존에 생성/편집된 내용이 있으면 유지
            summaryContent: existing.summaryContent ?? s.summaryContent,
            // audioSegments 등도 기존값이 있으면 유지
            audioSegments: existing.audioSegments ?? s.audioSegments,
          };
        });
      }

      // 동일 길이일 때는 로컬 상태 유지
      return prev;
    });
  }, [documentId, slideSummaries]);

  // 현재 슬라이드 변경 시 해당 요약으로 스크롤
  useEffect(() => {
    const slideRef = slideRefs.current[currentSlide];
    if (slideRef) {
      slideRef.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [currentSlide]);

  // DB에서 요약 데이터 로드
  useEffect(() => {
    const loadSummaries = async () => {
      try {
        const dbSummaries = await fetchSlideSummaries(documentId);
        setSummaries(prev => {
          const updated = [...prev];
          dbSummaries.forEach(dbSummary => {
            const index = updated.findIndex(s => s.slideNumber === dbSummary.slide_number);
            if (index >= 0) {
              updated[index] = {
                ...updated[index],
                summaryContent: dbSummary.summary_content,
              };
            }
          });
          return updated;
        });
      } catch (err) {
        console.error("요약 데이터 로드 실패:", err);
      }
    };

    loadSummaries();
  }, [documentId]);

  // 교수님 설명(녹음 기반) 로드
  useEffect(() => {
    setProfNotesBySlide(fetchProfessorNotesMap(documentId));
  }, [documentId]);

  // 모달/탭 이동 후에도 녹음 배너 유지 (mock 상태 복구)
  useEffect(() => {
    const state = loadMockRecordingState();
    if (state.active) setIsRecordingBanner(true);
  }, [documentId]);

  // 녹음 처리 완료 후(전사/정리/매칭) 실시간 갱신
  useEffect(() => {
    const handler = (e: any) => {
      const docId = e?.detail?.documentId;
      if (!docId || docId !== documentId) return;
      setProfNotesBySlide(fetchProfessorNotesMap(documentId));
    };
    window.addEventListener("aone_prof_notes_updated", handler as EventListener);
    return () => window.removeEventListener("aone_prof_notes_updated", handler as EventListener);
  }, [documentId]);

  // 임시 녹음 모드: 녹음 시작/완료 이벤트 처리
  useEffect(() => {
    const onStart = (e: any) => {
      const docId = e?.detail?.documentId;
      if (docId === documentId) setIsRecordingBanner(true);
    };
    const onDone = async (e: any) => {
      const docId = e?.detail?.documentId;
      if (docId !== documentId) return;
      setIsRecordingBanner(false);

      const tiptapToText = (node: any): string => {
        if (!node) return "";
        if (typeof node === "string") return node;
        if (typeof node.text === "string") return node.text;
        const content = Array.isArray(node.content) ? node.content : [];
        return content.map(tiptapToText).filter(Boolean).join(" ");
      };

      const notes = summaries
        .map((s) => {
          const base = tiptapToText(s.summaryContent).trim();
          if (!base) return null;
          const text = `학생 여러분, 이 슬라이드의 핵심을 짚어봅시다. ${base}`;
          return { slide_number: s.slideNumber, text };
        })
        .filter(Boolean) as Array<{ slide_number: number; text: string }>;

      if (notes.length > 0) {
        saveProfessorNotesForSlides(documentId, "mock-recording", notes);
        setProfNotesBySlide(fetchProfessorNotesMap(documentId));
        window.dispatchEvent(new CustomEvent("aone_prof_notes_updated", { detail: { documentId } }));
      }
    };
    window.addEventListener("aone_mock_recording_start", onStart);
    window.addEventListener("aone_mock_recording_done", onDone);
    return () => {
      window.removeEventListener("aone_mock_recording_start", onStart);
      window.removeEventListener("aone_mock_recording_done", onDone);
    };
  }, [documentId, summaries]);

  const handleSummaryChange = useCallback((slideNumber: number, content: any) => {
    setSummaries(prev =>
      prev.map(s =>
        s.slideNumber === slideNumber
          ? { ...s, summaryContent: content }
          : s
      )
    );

    // 기존 타이머 취소
    if (saveTimeouts.current[slideNumber]) {
      clearTimeout(saveTimeouts.current[slideNumber]);
    }

    // 디바운스된 저장 (1초 후)
    saveTimeouts.current[slideNumber] = setTimeout(async () => {
      setSaving(prev => ({ ...prev, [slideNumber]: true }));
      try {
        await saveSlideSummary(documentId, slideNumber, content);
      } catch (err) {
        console.error("요약 저장 실패:", err);
        alert("요약 저장에 실패했습니다.");
      } finally {
        setSaving(prev => ({ ...prev, [slideNumber]: false }));
        delete saveTimeouts.current[slideNumber];
      }
    }, 1000);
  }, [documentId]);

  const handleAISummarize = async (slideNumber: number) => {
    if (!storagePath) {
      alert("파일 정보를 찾을 수 없습니다.");
      return;
    }

    setSaving(prev => ({ ...prev, [slideNumber]: true }));
    try {
      // 개별 요약은 기존 엔드포인트 사용 (slideText 없이도 동작하도록 API는 구성되어 있음)
      // 필요 시 추후 "단일 슬라이드"도 PDF를 Gemini에 직접 주는 방식으로 개선 가능
      const result = await summarizeSlideWithAI(storagePath, slideNumber, documentId);
      setSummaries(prev =>
        prev.map(s =>
          s.slideNumber === slideNumber
            ? { ...s, summaryContent: result.summary_content }
            : s
        )
      );
    } catch (err: any) {
      console.error("AI 요약 실패:", err);
      alert("AI 요약에 실패했습니다: " + err.message);
    } finally {
      setSaving(prev => ({ ...prev, [slideNumber]: false }));
    }
  };

  const handleSummarizeAll = async () => {
    if (!storagePath) {
      alert("파일 정보를 찾을 수 없습니다.");
      return;
    }

    if (!confirm(`총 ${summaries.length}개의 슬라이드에 대해 AI 요약을 생성하시겠습니까?`)) {
      return;
    }

    setIsSummarizingAll(true);
    
    try {
      // 단순화: PDF 원본을 Gemini에 통째로 전달 → slide_number별 요약을 한 번에 받아서 채움
      const saved = await summarizeAllSlidesWithAI(storagePath, documentId);

      setSummaries(prev => {
        const map = new Map(saved.map(s => [s.slide_number, s.summary_content]));
        return prev.map(slide =>
          map.has(slide.slideNumber)
            ? { ...slide, summaryContent: map.get(slide.slideNumber) }
            : slide
        );
      });

      alert(`모든 슬라이드 요약이 완료되었습니다. (생성 ${saved.length}/${summaries.length})`);
    } catch (err: any) {
      console.error("전체 요약 실패:", err);
      alert("전체 요약 도중 오류가 발생했습니다: " + err.message);
    } finally {
      setIsSummarizingAll(false);
    }
  };

  const toggleAudio = (slideNumber: number) => {
    setExpandedAudio(prev => prev === slideNumber ? null : slideNumber);
  };

  return (
    <div className="h-full flex flex-col">
      {isRecordingBanner && (
        <div className="px-4 py-2 bg-yellow-500/15 text-yellow-200 text-sm border-b border-yellow-500/40 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
          녹음 중...
        </div>
      )}
      {/* 전체 요약 버튼 영역 */}
      <div className="p-4 border-b border-border bg-background">
        <button
          onClick={handleSummarizeAll}
          disabled={isSummarizingAll}
          className={`
            w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
            ${isSummarizingAll 
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20"
            }
          `}
        >
          <Sparkles className={`w-5 h-5 ${isSummarizingAll ? "animate-pulse" : ""}`} />
          {isSummarizingAll ? "전체 슬라이드 요약 중..." : "모든 슬라이드 요약하기"}
        </button>
      </div>

      {/* 슬라이드별 요약 목록 - 스크롤 가능 */}
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="p-4 space-y-3">
          {summaries.map((slide) => (
            <div
              key={slide.slideNumber}
              ref={(el) => { slideRefs.current[slide.slideNumber] = el; }}
              className={`
                bg-surface rounded-lg shadow-sm border-2 transition-all cursor-pointer
                ${currentSlide === slide.slideNumber
                  ? "border-primary shadow-md"
                  : "border-border hover:border-secondary hover:shadow"
                }
              `}
              onClick={() => onSlideChange(slide.slideNumber)}
            >
              {/* 슬라이드 헤더 */}
              <div className="p-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${currentSlide === slide.slideNumber
                      ? "bg-primary text-white"
                      : "bg-secondary text-gray-400"
                      }`}>
                      <span className="text-xs font-bold">
                        {slide.slideNumber}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium text-sm text-white">
                        {slide.title}
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {saving[slide.slideNumber] && (
                      <span className="text-xs text-text-secondary">처리 중...</span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAISummarize(slide.slideNumber);
                      }}
                      disabled={saving[slide.slideNumber]}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-primary transition-colors disabled:opacity-50"
                      title="AI 요약 생성"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                    {currentSlide === slide.slideNumber && (
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                    )}
                  </div>
                </div>
              </div>

              {/* 통합 요약 내용 (AI 요약 + 사용자 편집) */}
              <div className="p-3" onClick={(e) => e.stopPropagation()}>
                <TipTapEditor
                  content={slide.summaryContent}
                  onChange={(content) => handleSummaryChange(slide.slideNumber, content)}
                  placeholder="AI 요약 내용을 수정하거나 추가할 수 있습니다..."
                  editable={true}
                />

                {/* 교수님 설명 (음성 구간이 있는 경우) */}
                {profNotesBySlide.get(slide.slideNumber) && (
                  <div className="mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAudio(slide.slideNumber);
                      }}
                      className="flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-white transition-colors"
                    >
                      {expandedAudio === slide.slideNumber ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      교수님 설명
                    </button>

                    {expandedAudio === slide.slideNumber && (
                      <div className="mt-2 p-3 bg-secondary rounded-lg border border-border">
                        <div className="flex items-start gap-2">
                          <button className="p-1.5 bg-primary hover:bg-primary/90 text-white rounded-full transition-colors">
                            <Play className="w-3 h-3" />
                          </button>
                          <div className="flex-1">
                            <p className="text-xs text-white leading-relaxed">
                              {profNotesBySlide.get(slide.slideNumber)}
                            </p>
                            <div className="mt-1 text-xs text-text-secondary">
                              <span>녹음 기반 정리본</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
