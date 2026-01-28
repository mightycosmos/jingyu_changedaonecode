"use client";

import { useMemo, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import TipTapEditor from "./TipTapEditor";

interface AITutorViewProps {
  documentId: string;
  fullSummary: any;
}

type ChatMessage = { role: "user" | "assistant"; content: string };

const tiptapToText = (node: any): string => {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node.text === "string") return node.text;
  const content = Array.isArray(node.content) ? node.content : [];
  return content.map(tiptapToText).filter(Boolean).join(" ");
};

export default function AITutorView({ documentId, fullSummary }: AITutorViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "안녕하세요! 궁금한 내용을 물어보세요. 문서 요약을 참고해 도와드릴게요." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contextText = useMemo(() => {
    return tiptapToText(fullSummary || "").trim();
  }, [fullSummary]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setError(null);
    const nextMessages: ChatMessage[] = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const res = await fetch("/api/tutor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          contextText,
          messages: nextMessages,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || j?.details || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data?.reply || "답변을 생성하지 못했어요." }]);
    } catch (e: any) {
      setError(e?.message || "응답을 가져오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="text-white font-semibold text-sm">AI 튜터</div>
          <div className="text-xs text-text-secondary">문서 요약 기반 Q&A</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`max-w-3xl rounded-2xl px-4 py-3 border ${
              m.role === "assistant" ? "bg-surface border-border text-white" : "bg-primary/10 border-primary/30 text-white"
            }`}
          >
            <div className="text-xs text-text-secondary mb-1">
              {m.role === "assistant" ? "AI 튜터" : "나"}
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
          </div>
        ))}
      </div>

      {error && <div className="px-4 pb-2 text-sm text-red-400">{error}</div>}

      <div className="border-t border-border p-4 bg-background">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="튜터에게 질문을 입력하세요..."
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="p-3 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="text-xs text-text-secondary mt-2">
          컨텍스트 길이가 길면 답변이 짧아질 수 있어요.
        </div>
      </div>
    </div>
  );
}


