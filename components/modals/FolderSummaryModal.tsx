"use client";

import TipTapEditor from "@/components/document/TipTapEditor";

interface FolderSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  summaryContent: any;
  stats?: {
    totalDocuments: number;
    includedDocuments: number;
    skippedDocuments: number;
  };
  updatedAt?: string;
}

export default function FolderSummaryModal({
  isOpen,
  onClose,
  title,
  summaryContent,
  stats,
  updatedAt,
}: FolderSummaryModalProps) {
  if (!isOpen) return null;

  const isValidTipTapDoc =
    !!summaryContent &&
    summaryContent?.type === "doc" &&
    Array.isArray(summaryContent?.content) &&
    summaryContent.content.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div className="relative w-[min(900px,92vw)] max-h-[85vh] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-white font-bold text-lg">{title}</div>
            <div className="text-xs text-text-secondary mt-1">
              {stats && (
                <span>
                  포함 {stats.includedDocuments}/{stats.totalDocuments} (누락 {stats.skippedDocuments})
                </span>
              )}
              {updatedAt && (
                <span className="ml-3">업데이트: {new Date(updatedAt).toLocaleString("ko-KR")}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-background border border-border text-white hover:bg-secondary transition-colors text-sm font-semibold"
          >
            닫기
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(85vh-72px)]">
          {!isValidTipTapDoc ? (
            <div className="bg-background border border-border rounded-xl p-6 text-center">
              <div className="text-white font-semibold mb-2">요약 내용이 비어있습니다</div>
              <div className="text-text-secondary text-sm">
                다시 한 번 <b>폴더 전체 요약하기</b>를 눌러 재생성해 주세요.
              </div>
            </div>
          ) : (
            <TipTapEditor
              content={summaryContent}
              onChange={() => {}}
              editable={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}


