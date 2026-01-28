"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  parentId?: string | null;
  title?: string;
}

export default function CreateFolderModal({
  isOpen,
  onClose,
  onSubmit,
  parentId,
  title = "새 폴더 만들기",
}: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState("");

  useEffect(() => {
    if (isOpen) {
      setFolderName("");
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (folderName.trim()) {
      onSubmit(folderName.trim());
      setFolderName("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-3xl shadow-2xl w-full max-w-md border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors group"
          >
            <X className="w-5 h-5 text-gray-500 group-hover:text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          <div className="mb-8">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
              폴더 이름
            </label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="폴더 이름을 입력하세요"
              className="w-full px-5 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-white placeholder:text-gray-600 transition-all shadow-inner"
              autoFocus
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-secondary text-white rounded-xl hover:bg-secondary/80 transition-all font-bold border border-border"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!folderName.trim()}
              className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              만들기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

