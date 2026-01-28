"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, ExternalLink } from "lucide-react";
import { summarizeFullWithAI, fetchFullSummary } from "@/lib/slideSummaries";
import TipTapEditor from "./TipTapEditor";
import { useEffect } from "react";

interface FullSummaryViewProps {
  fullSummary: any;
  documentId: string;
}

export default function FullSummaryView({ fullSummary: initialFullSummary, documentId }: FullSummaryViewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [fullSummary, setFullSummary] = useState<any>(initialFullSummary);

  useEffect(() => {
    const loadStoredSummary = async () => {
      if (!fullSummary) {
        const stored = await fetchFullSummary(documentId);
        if (stored) setFullSummary(stored);
      }
    };
    loadStoredSummary();
  }, [documentId]);

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      const result = await summarizeFullWithAI(documentId);
      setFullSummary(result);
    } catch (err: any) {
      console.error("전체 요약 실패:", err);
      alert(err.message || "전체 요약에 실패했습니다.");
    } finally {
      setIsGenerating(false);
    }
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
            슬라이드별 요약과 교수님의 음성 녹음을 바탕으로
            <br />
            문서 전체의 핵심 내용을 요약해드립니다.
          </p>
          <button
            onClick={handleGenerateSummary}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium inline-flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            전체요약하기
          </button>
          <p className="text-xs text-text-secondary mt-4">
            녹음 파일이 있다면 교수님 설명을 70% 반영합니다
          </p>
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

  // 전체 요약이 있는 경우
  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* 헤더 */}
      <div className="bg-background border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">전체 요약</h2>
              <p className="text-sm text-text-secondary">AI가 생성한 문서 전체 요약</p>
            </div>
          </div>
          <button
            onClick={handleGenerateSummary}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-surface transition-colors text-sm font-medium text-white"
          >
            <RefreshCw className="w-4 h-4" />
            다시 생성
          </button>
        </div>
      </div>

      {/* 요약 내용 */}
      <div className="p-6">
        <div className="bg-surface rounded-xl shadow-sm border border-border p-8">
          <TipTapEditor
            content={fullSummary}
            onChange={() => { }}
            editable={false}
          />
        </div>
      </div>
    </div>
  );
}



