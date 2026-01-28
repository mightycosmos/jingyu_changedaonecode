"use client";

import { AlertTriangle } from "lucide-react";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
  itemType: "folder" | "document";
}

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType,
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-3xl shadow-2xl w-full max-w-md border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8">
          <div className="flex items-start gap-4 mb-8">
            <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center flex-shrink-0 border border-red-500/20">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
                {itemType === "folder" ? "폴더 삭제" : "문서 삭제"}
              </h2>
              <p className="text-gray-400 leading-relaxed font-medium">
                <span className="text-white font-bold">"{itemName}"</span>을(를) 정말 삭제하시겠습니까?
              </p>
              {itemType === "folder" && (
                <p className="text-xs text-red-400 font-bold mt-3 px-3 py-1.5 bg-red-400/10 rounded-lg inline-block border border-red-400/20">
                  폴더 내 모든 항목도 함께 삭제됩니다.
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-secondary text-white rounded-xl hover:bg-secondary/80 transition-all font-bold border border-border"
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-bold shadow-lg shadow-red-600/20"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

