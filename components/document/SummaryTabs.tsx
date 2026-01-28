"use client";

import { useState } from "react";
import SlideSummaryView from "./SlideSummaryView";
import FullSummaryView from "./FullSummaryView";
import FullSummaryViewV2 from "./FullSummaryViewV2";
import RecordingView from "./RecordingView";
import AITutorView from "./AITutorView";

interface SlideSummary {
  slideNumber: number;
  title: string;
  summaryContent: any; // TipTap JSON
  userNotesContent: any; // TipTap JSON
  audioSegments: any[];
}

interface SummaryTabsProps {
  documentId: string;
  slideSummaries: SlideSummary[];
  fullSummary: any;
  currentSlide: number;
  onSlideChange: (slide: number) => void;
  storagePath?: string;
}

type TabType = "slide" | "full" | "recording" | "tutor";

export default function SummaryTabs({
  documentId,
  slideSummaries,
  fullSummary,
  currentSlide,
  onSlideChange,
  storagePath,
}: SummaryTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("slide");

  const tabs = [
    { id: "slide" as TabType, label: "슬라이드별 요약" },
    { id: "full" as TabType, label: "전체 요약" },
    { id: "recording" as TabType, label: "녹음" },
    { id: "tutor" as TabType, label: "AI 튜터" },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* 탭 헤더 */}
      <div className="border-b border-border bg-background">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-6 py-3 font-medium text-sm transition-colors relative
                ${activeTab === tab.id
                  ? "text-primary border-b-2 border-primary"
                  : "text-text-secondary hover:text-white"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "slide" && (
          <SlideSummaryView
            documentId={documentId}
            slideSummaries={slideSummaries}
            currentSlide={currentSlide}
            onSlideChange={onSlideChange}
            storagePath={storagePath}
          />
        )}
        {activeTab === "full" && (
          <FullSummaryViewV2
            documentId={documentId}
            storagePath={storagePath}
          />
        )}
        {activeTab === "recording" && (
          <RecordingView documentId={documentId} storagePath={storagePath} />
        )}
        {activeTab === "tutor" && (
          <AITutorView documentId={documentId} fullSummary={fullSummary} />
        )}
      </div>
    </div>
  );
}

