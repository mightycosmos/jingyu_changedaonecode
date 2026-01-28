"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, Play, Pause, Trash2, Download, Clock, Sparkles } from "lucide-react";
import { uploadFileToStorage } from "@/lib/files";
import { saveProfessorNotesForSlides, saveRecordingMetadata } from "@/lib/recordings";
import { fetchSlideSummaries } from "@/lib/slideSummaries";

const MOCK_RECORDING_KEY = "aone_mock_recording_state";

const loadMockRecordingState = () => {
  if (typeof window === "undefined") return { active: false, startedAt: null as number | null };
  try {
    const raw = localStorage.getItem(MOCK_RECORDING_KEY);
    if (!raw) return { active: false, startedAt: null };
    const obj = JSON.parse(raw);
    return {
      active: !!obj?.active,
      startedAt: typeof obj?.startedAt === "number" ? obj.startedAt : null,
    };
  } catch {
    return { active: false, startedAt: null };
  }
};

const saveMockRecordingState = (active: boolean, startedAt: number | null) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(MOCK_RECORDING_KEY, JSON.stringify({ active, startedAt }));
};

const professorStyle = (base: string, idx: number) => {
  const words = base.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const take = Math.max(8, Math.floor(words.length * 0.6));
  const snippet = words.slice(0, take).join(" ");
  const endings = [
    "이 부분을 놓치지 마.",
    "여기가 흐름을 잡는 포인트야.",
    "이 정도만 기억해도 충분해.",
    "이 핵심을 중심으로 이해하면 돼.",
    "여기서 개념이 연결돼.",
  ];
  const ending = endings[idx % endings.length];
  return `${snippet} ${ending}`;
};

const tiptapToText = (node: any): string => {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node.text === "string") return node.text;
  const content = Array.isArray(node.content) ? node.content : [];
  return content.map(tiptapToText).filter(Boolean).join(" ");
};

interface RecordingViewProps {
  documentId: string;
  storagePath?: string; // PDF storage path (for slide matching)
}

interface Recording {
  id: string;
  name: string;
  duration: number;
  size: number;
  createdAt: Date;
  storagePath?: string; // audio upload path
  transcript?: string;
  notesSummary?: string;
  showTranscript?: boolean;
}

export default function RecordingView({ documentId, storagePath }: RecordingViewProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>("");
  const [processElapsed, setProcessElapsed] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [transcribeLanguage, setTranscribeLanguage] = useState<"ko" | "auto">("ko");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioUrlMapRef = useRef<Map<string, string>>(new Map());
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const processTimerRef = useRef<NodeJS.Timeout | null>(null);

  // mock 녹음 상태 복구
  useEffect(() => {
    const state = loadMockRecordingState();
    if (state.active && state.startedAt) {
      setIsRecording(true);
      setRecordingTime(Math.floor((Date.now() - state.startedAt) / 1000));
      window.dispatchEvent(new CustomEvent("aone_mock_recording_start", { detail: { documentId } }));
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const next = prev + 1;
          if (next >= 5400) {
            stopRecording();
            return prev;
          }
          return next;
        });
      }, 1000);
    }
  }, [documentId]);

  // load saved recordings (local)
  useEffect(() => {
    const stored = saveRecordingMetadata.load(documentId);
    if (stored.length > 0) {
      setRecordings(
        stored.map((r) => ({
          id: r.id,
          name: r.name,
          duration: r.duration,
          size: r.size,
          createdAt: new Date(r.createdAt),
          storagePath: r.storagePath,
          transcript: r.transcript,
          notesSummary: r.notesSummary,
        }))
      );
    }
  }, [documentId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  const formatFileSize = (bytes: number) => {
    const mb = (bytes / (1024 * 1024)).toFixed(2);
    return `${mb} MB`;
  };

  const isLowInformationTranscript = (text: string) => {
    const t = (text || "").trim();
    if (!t) return true;
    const noWs = t.replace(/\s/g, "");
    if (noWs.length < 20) return true;
    const meaningful = (t.match(/[가-힣A-Za-z0-9]/g) || []).length;
    const ratio = meaningful / Math.max(1, noWs.length);
    if (meaningful < 30) return true;
    if (ratio < 0.05) return true;
    const unique = new Set(noWs.split(""));
    if (unique.size <= 3 && (unique.has(".") || unique.has("·") || unique.has("…"))) return true;
    return false;
  };

  useEffect(() => {
    if (isProcessing) {
      setProcessElapsed(0);
      if (processTimerRef.current) clearInterval(processTimerRef.current);
      processTimerRef.current = setInterval(() => setProcessElapsed((s) => s + 1), 1000);
    } else {
      if (processTimerRef.current) clearInterval(processTimerRef.current);
      processTimerRef.current = null;
      setProcessElapsed(0);
    }
    return () => {
      if (processTimerRef.current) clearInterval(processTimerRef.current);
      processTimerRef.current = null;
    };
  }, [isProcessing]);

  const processAudioFile = async (file: File, meta: { id: string; name: string; duration: number; createdAt: Date }) => {
    try {
      setIsProcessing(true);
      setProcessStatus("음성 파일 업로드 중...");
      setError(null);

      const audioStoragePath = await uploadFileToStorage(file, "local-guest-user-id", null);

      setProcessStatus("OpenAI로 음성 텍스트 변환 중... (몇 분 걸릴 수 있어요)");
      const trRes = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: audioStoragePath, language: transcribeLanguage }),
      });
      if (!trRes.ok) {
        const j = await trRes.json().catch(() => ({}));
        const msg = j?.error && j?.details ? `${j.error} (${j.details})` : (j?.error || j?.details);
        throw new Error(msg || `전사 실패 (HTTP ${trRes.status})`);
      }
      const trData = await trRes.json();
      const transcriptText = String(trData?.text || "").trim();
      // 텍스트가 너무 짧거나, 점/기호만 잔뜩 있는 저정보 전사면 후속(정리/매칭) 중단
      if (isLowInformationTranscript(transcriptText)) {
        // 전사 결과는 저장해서 사용자가 '전사 보기'로 확인할 수 있게 함
        saveRecordingMetadata.save(documentId, {
          id: meta.id,
          name: meta.name,
          duration: meta.duration,
          size: file.size,
          createdAt: meta.createdAt.toISOString(),
          storagePath: audioStoragePath,
          transcript: transcriptText,
          notesSummary: undefined,
        });
        setRecordings((prev) =>
          prev.map((r) =>
            r.id === meta.id ? { ...r, storagePath: audioStoragePath, transcript: transcriptText, notesSummary: undefined } : r
          )
        );
        throw new Error(
          "전사 결과가 거의 기호/점만 포함하거나 내용이 부족합니다. 음성에 실제 말소리가 있는지 재생으로 확인하고, 더 큰 음량/더 긴 구간으로 다시 업로드해 주세요. (언어는 '자동'으로도 시도 가능)"
        );
      }

      setProcessStatus("텍스트 정리(요약) 중...");
      const sumRes = await fetch("/api/summarize/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptText }),
      });
      if (!sumRes.ok) {
        const j = await sumRes.json().catch(() => ({}));
        const msg = j?.error && j?.details ? `${j.error} (${j.details})` : (j?.error || j?.details);
        throw new Error(msg || `정리 실패 (HTTP ${sumRes.status})`);
      }
      const sumData = await sumRes.json();
      const notesSummary = String(sumData?.notesText || "").trim();
      if (!notesSummary) throw new Error("정리된 텍스트가 비어있습니다.");

      setProcessStatus("슬라이드별로 교수님 설명 매칭 중...");
      if (storagePath) {
        const matchRes = await fetch("/api/match/transcript-to-slides", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath, notesText: notesSummary }),
        });
        if (!matchRes.ok) {
          const j = await matchRes.json().catch(() => ({}));
          throw new Error(j?.error || j?.details || `매칭 실패 (HTTP ${matchRes.status})`);
        }
        const matchData = await matchRes.json();
        const mapped = Array.isArray(matchData?.notes) ? matchData.notes : [];
        saveProfessorNotesForSlides(documentId, meta.id, mapped);
        // 슬라이드 UI가 즉시 갱신되도록 이벤트 발송
        window.dispatchEvent(new CustomEvent("aone_prof_notes_updated", { detail: { documentId } }));
      }

      // persist recording metadata
      saveRecordingMetadata.save(documentId, {
        id: meta.id,
        name: meta.name,
        duration: meta.duration,
        size: file.size,
        createdAt: meta.createdAt.toISOString(),
        storagePath: audioStoragePath,
        transcript: transcriptText,
        notesSummary,
      });

      setRecordings((prev) =>
        prev.map((r) =>
          r.id === meta.id
            ? { ...r, storagePath: audioStoragePath, transcript: transcriptText, notesSummary }
            : r
        )
      );

      setProcessStatus("완료!");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "처리 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProcessStatus(""), 1500);
    }
  };

  const reprocessExistingRecording = async (rec: Recording) => {
    if (!rec.storagePath) {
      setError("재처리할 업로드 경로(storagePath)가 없습니다. 다시 업로드해 주세요.");
      return;
    }
    try {
      setIsProcessing(true);
      setProcessStatus("OpenAI로 음성 텍스트 변환 중... (몇 분 걸릴 수 있어요)");
      setError(null);

      const trRes = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: rec.storagePath, language: transcribeLanguage }),
      });
      if (!trRes.ok) {
        const j = await trRes.json().catch(() => ({}));
        const msg = j?.error && j?.details ? `${j.error} (${j.details})` : (j?.error || j?.details);
        throw new Error(msg || `전사 실패 (HTTP ${trRes.status})`);
      }
      const trData = await trRes.json();
      const transcriptText = String(trData?.text || "").trim();
      if (isLowInformationTranscript(transcriptText)) {
        saveRecordingMetadata.save(documentId, {
          id: rec.id,
          name: rec.name,
          duration: rec.duration,
          size: rec.size,
          createdAt: rec.createdAt.toISOString(),
          storagePath: rec.storagePath,
          transcript: transcriptText,
          notesSummary: undefined,
        });
        setRecordings((prev) =>
          prev.map((r) => (r.id === rec.id ? { ...r, transcript: transcriptText, notesSummary: undefined } : r))
        );
        throw new Error(
          "전사 결과가 거의 기호/점만 포함하거나 내용이 부족합니다. 음성에 실제 말소리가 있는지 재생으로 확인하고, 더 큰 음량/더 긴 구간으로 다시 업로드해 주세요. (언어는 '자동'으로도 시도 가능)"
        );
      }

      setProcessStatus("텍스트 정리(요약) 중...");
      const sumRes = await fetch("/api/summarize/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptText }),
      });
      if (!sumRes.ok) {
        const j = await sumRes.json().catch(() => ({}));
        const msg = j?.error && j?.details ? `${j.error} (${j.details})` : (j?.error || j?.details);
        throw new Error(msg || `정리 실패 (HTTP ${sumRes.status})`);
      }
      const sumData = await sumRes.json();
      const notesSummary = String(sumData?.notesText || "").trim();
      if (!notesSummary) throw new Error("정리된 텍스트가 비어있습니다.");

      setProcessStatus("슬라이드별로 교수님 설명 매칭 중...");
      if (storagePath) {
        const matchRes = await fetch("/api/match/transcript-to-slides", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath, notesText: notesSummary }),
        });
        if (!matchRes.ok) {
          const j = await matchRes.json().catch(() => ({}));
          throw new Error(j?.error || j?.details || `매칭 실패 (HTTP ${matchRes.status})`);
        }
        const matchData = await matchRes.json();
        const mapped = Array.isArray(matchData?.notes) ? matchData.notes : [];
        saveProfessorNotesForSlides(documentId, rec.id, mapped);
        window.dispatchEvent(new CustomEvent("aone_prof_notes_updated", { detail: { documentId } }));
      }

      saveRecordingMetadata.save(documentId, {
        id: rec.id,
        name: rec.name,
        duration: rec.duration,
        size: rec.size,
        createdAt: rec.createdAt.toISOString(),
        storagePath: rec.storagePath,
        transcript: transcriptText,
        notesSummary,
      });

      setRecordings((prev) =>
        prev.map((r) => (r.id === rec.id ? { ...r, transcript: transcriptText, notesSummary } : r))
      );
      setProcessStatus("완료!");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "재처리 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProcessStatus(""), 1500);
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      if (isProcessing) return;
      // Mock mode: 실제 녹음 대신 상태만 표시
      const startedAt = Date.now();
      setIsRecording(true);
      setRecordingTime(0);
      saveMockRecordingState(true, startedAt);
      window.dispatchEvent(new CustomEvent("aone_mock_recording_start", { detail: { documentId } }));

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 5400) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "녹음을 시작하지 못했습니다.");
      setIsRecording(false);
    }
  };

  const generateMockProfessorNotes = async () => {
    try {
      const summaries = await fetchSlideSummaries(documentId);
      const notes = summaries
        .map((s, i) => {
          const base = tiptapToText(s.summary_content).trim();
          if (!base) return null;
          return {
            slide_number: s.slide_number,
            text: professorStyle(base, i),
          };
        })
        .filter(Boolean) as Array<{ slide_number: number; text: string }>;
      if (notes.length > 0) {
        saveProfessorNotesForSlides(documentId, "mock-recording", notes);
        window.dispatchEvent(new CustomEvent("aone_prof_notes_updated", { detail: { documentId } }));
      }
    } catch (err) {
      console.error("mock professor notes generation failed:", err);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    saveMockRecordingState(false, null);
    window.dispatchEvent(new CustomEvent("aone_mock_recording_done", { detail: { documentId } }));
    await generateMockProfessorNotes();
  };

  const togglePlay = (id: string) => {
    setPlayingId(prev => prev === id ? null : id);
  };

  const deleteRecording = (id: string) => {
    const url = audioUrlMapRef.current.get(id);
    if (url) URL.revokeObjectURL(url);
    audioUrlMapRef.current.delete(id);
    setRecordings(prev => prev.filter(r => r.id !== id));
    if (playingId === id) {
      setPlayingId(null);
    }
    saveRecordingMetadata.remove(documentId, id);
  };

  const audioUrlFor = (rec: Recording) => {
    const blobUrl = audioUrlMapRef.current.get(rec.id);
    if (blobUrl) return blobUrl;
    if (rec.storagePath) return rec.storagePath;
    return null;
  };

  const handleUploadClick = () => {
    if (isProcessing || isRecording) return;
    uploadInputRef.current?.click();
  };

  const handleUploadFile = async (file: File) => {
    if (!file) return;
    setError(null);

    const id = Date.now().toString();
    const createdAt = new Date();
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const name = baseName || `업로드 녹음파일 ${recordings.length + 1}`;

    const newRec: Recording = {
      id,
      name,
      duration: 0,
      size: file.size,
      createdAt,
    };
    setRecordings((prev) => [newRec, ...prev]);

    await processAudioFile(file, { id, name, duration: 0, createdAt });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* 녹음 컨트롤 */}
      <div className="bg-background border-b border-border p-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-lg font-bold text-white mb-4">강의 녹음</h2>
          
          <div className="bg-surface rounded-xl p-8 text-center border border-border">
            {!isRecording ? (
              <>
                <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4 hover:bg-red-700 transition-colors cursor-pointer" onClick={startRecording}>
                  <Mic className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  녹음 시작하기
                </h3>
                <p className="text-sm text-text-secondary">
                  최대 90분까지 녹음 가능합니다
                </p>
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleUploadClick}
                    disabled={isProcessing}
                    className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-surface transition-colors text-sm font-semibold text-white disabled:opacity-50"
                  >
                    녹음 파일 업로드
                  </button>
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <span>언어</span>
                    <select
                      value={transcribeLanguage}
                      onChange={(e) => setTranscribeLanguage(e.target.value as any)}
                      className="bg-background border border-border rounded px-2 py-1 text-white"
                      disabled={isProcessing}
                    >
                      <option value="ko">한국어</option>
                      <option value="auto">자동</option>
                    </select>
                  </div>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      // reset input so same file can be selected again
                      e.target.value = "";
                      if (f) await handleUploadFile(f);
                    }}
                  />
                </div>
                {isProcessing && (
                  <p className="text-sm text-text-secondary mt-4">
                    {processStatus} {processElapsed > 0 ? `(경과 ${formatTime(processElapsed)})` : ""}
                  </p>
                )}
                {error && (
                  <p className="text-sm text-red-400 mt-4">{error}</p>
                )}
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <Mic className="w-10 h-10 text-white" />
                </div>
                <div className="text-4xl font-bold text-red-600 mb-4">
                  {formatTime(recordingTime)}
                </div>
                <button
                  onClick={stopRecording}
                  className="px-6 py-3 bg-secondary hover:bg-secondary-hover text-white rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <Square className="w-5 h-5" />
                  녹음 완료
                </button>
                <p className="text-xs text-text-secondary mt-4">
                  {recordingTime >= 5100 && "⚠️ 85분이 지났습니다. 곧 자동으로 중지됩니다."}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 녹음 목록 */}
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-lg font-semibold text-white mb-4">
            녹음 파일 ({recordings.length})
          </h3>

          {recordings.length === 0 ? (
            <div className="bg-surface rounded-xl border border-border p-12 text-center">
              <Clock className="w-12 h-12 text-text-secondary mx-auto mb-3" />
              <p className="text-text-secondary">아직 녹음된 파일이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recordings.map((recording) => (
                <div
                  key={recording.id}
                  className="bg-surface rounded-xl border border-border p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => togglePlay(recording.id)}
                      className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors flex-shrink-0"
                    >
                      {playingId === recording.id ? (
                        <Pause className="w-5 h-5 text-primary" />
                      ) : (
                        <Play className="w-5 h-5 text-primary" />
                      )}
                    </button>

                    <div className="flex-1">
                      <input
                        type="text"
                        value={recording.name}
                        onChange={(e) => {
                          setRecordings(prev =>
                            prev.map(r =>
                              r.id === recording.id
                                ? { ...r, name: e.target.value }
                                : r
                            )
                          );
                        }}
                        className="font-medium text-white bg-transparent border-none focus:outline-none focus:ring-0 w-full placeholder:text-text-secondary"
                      />
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-text-secondary">
                          {formatDuration(recording.duration)}
                        </span>
                        <span className="text-sm text-text-secondary">•</span>
                        <span className="text-sm text-text-secondary">
                          {formatFileSize(recording.size)}
                        </span>
                        <span className="text-sm text-text-secondary">•</span>
                        <span className="text-sm text-text-secondary">
                          {recording.createdAt.toLocaleTimeString('ko-KR')}
                        </span>
                      </div>
                      {recording.notesSummary && (
                        <div className="mt-2 text-xs text-text-secondary line-clamp-2">
                          <span className="font-semibold text-white">정리본:</span> {recording.notesSummary}
                        </div>
                      )}
                      {recording.storagePath && (
                        <button
                          type="button"
                          className="mt-2 text-xs font-semibold text-primary hover:text-primary/90"
                          disabled={isProcessing}
                          onClick={() => reprocessExistingRecording(recording)}
                        >
                          전사/정리 재처리
                        </button>
                      )}
                      {recording.transcript && (
                        <div className="mt-2">
                          <button
                            type="button"
                            className="text-xs font-semibold text-primary hover:text-primary/90"
                            onClick={() =>
                              setRecordings((prev) =>
                                prev.map((r) =>
                                  r.id === recording.id ? { ...r, showTranscript: !r.showTranscript } : r
                                )
                              )
                            }
                          >
                            {recording.showTranscript ? "전사 접기" : "전사 보기"}
                          </button>
                          {recording.showTranscript && (
                            <pre className="mt-2 text-xs text-text-secondary whitespace-pre-wrap bg-background border border-border rounded-lg p-3 max-h-40 overflow-y-auto">
                              {recording.transcript}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        onClick={() => {
                          const url = audioUrlFor(recording);
                          if (!url) return;
                          const a = document.createElement("a");
                          a.href = url;
                          // best-effort extension
                          const ext = recording.storagePath?.split(".").pop() || "webm";
                          a.download = `${recording.name}.${ext}`;
                          a.click();
                        }}
                      >
                        <Download className="w-5 h-5 text-text-secondary" />
                      </button>
                      <button
                        onClick={() => deleteRecording(recording.id)}
                        className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5 text-red-600" />
                      </button>
                    </div>
                  </div>

                  {/* 재생 진행 바 */}
                  {playingId === recording.id && (
                    <div className="mt-4">
                      <div className="h-1 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-1/3 rounded-full animate-pulse"></div>
                      </div>
                      {audioUrlFor(recording) && (
                        <audio className="mt-3 w-full" controls src={audioUrlFor(recording) || undefined} />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {recordings.length > 0 && (
            <div className="mt-6 p-4 bg-surface rounded-lg border border-border">
              <p className="text-sm text-text-secondary">
                <Sparkles className="inline-block w-4 h-4 text-primary mr-2" />
                녹음 완료 후 자동으로 전사 → 정리 → 슬라이드 매칭이 진행됩니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

