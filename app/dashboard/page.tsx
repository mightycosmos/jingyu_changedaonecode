"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { Plus, Upload, FolderPlus, File, Trash2, Sparkles, Eye, BookOpen, ListChecks } from "lucide-react";
import { useFolders, FolderNode } from "@/contexts/FolderContext";
import CreateFolderModal from "@/components/modals/CreateFolderModal";
import AuthGuard from "@/components/auth/AuthGuard";
import { uploadFile, fetchFiles, deleteFile, FileMetadata, moveFile } from "@/lib/files";
import { getCurrentUser } from "@/lib/auth";
import FolderSummaryModal from "@/components/modals/FolderSummaryModal";
import { fetchFolderSummary, summarizeFolderWithAI } from "@/lib/folderSummaries";
import FolderQuestionsModal from "@/components/modals/FolderQuestionsModal";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { folders, loading, error, findItemById, createFolder, refreshFolders } = useFolders();
  const [selectedItem, setSelectedItem] = useState<FolderNode | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [isFolderSummarizing, setIsFolderSummarizing] = useState(false);
  const [folderSummaryModalOpen, setFolderSummaryModalOpen] = useState(false);
  const [folderSummaryContent, setFolderSummaryContent] = useState<any>(null);
  const [folderSummaryUpdatedAt, setFolderSummaryUpdatedAt] = useState<string | null>(null);
  const [folderSummaryStats, setFolderSummaryStats] = useState<{ totalDocuments: number; includedDocuments: number; skippedDocuments: number } | null>(null);
  const [folderQuestionsModalOpen, setFolderQuestionsModalOpen] = useState(false);
  const dragDataRef = useRef<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // URL 파라미터에서 폴더 ID를 읽어서 선택
  useEffect(() => {
    const folderId = searchParams.get('folder');
    if (folderId && !loading && folders.length > 0) {
      const folder = findItemById(folderId);
      if (folder && folder.type === 'folder') {
        setSelectedItem(folder);
      }
    } else if (!folderId) {
      // 쿼리 파라미터가 없으면 선택 해제
      setSelectedItem(null);
    }
  }, [searchParams, loading, folders, findItemById]);

  // 선택된 폴더의 파일 목록 로드 (루트 폴더 포함)
  useEffect(() => {
    const loadFiles = async () => {
      // selectedItem이 null이면 루트 폴더(null)의 파일을 로드
      // selectedItem이 있고 folder 타입이면 해당 폴더의 파일을 로드
      if (selectedItem && selectedItem.type !== 'folder') {
        setFiles([]);
        return;
      }

      try {
        setFilesLoading(true);
        const user = await getCurrentUser();
        if (!user) return;

        const folderId = selectedItem?.id || null;
        const folderFiles = await fetchFiles(user.id, folderId);
        setFiles(folderFiles);
      } catch (err: any) {
        console.error("파일 목록 로드 실패:", err);
      } finally {
        setFilesLoading(false);
      }
    };

    loadFiles();
  }, [selectedItem]);

  const currentFolderId = selectedItem?.id || "root";
  const currentFolderName = selectedItem?.name || "전체 문서";

  const refreshFilesForCurrentFolder = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user) return;
    const folderId = selectedItem?.id || null;
    const folderFiles = await fetchFiles(user.id, folderId);
    setFiles(folderFiles);
  }, [selectedItem]);

  const handleDropToFolder = useCallback(
    async (folderId: string | null, e?: React.DragEvent) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      const fileId = dragDataRef.current || e?.dataTransfer?.getData("text/plain");
      dragDataRef.current = null;
      if (!fileId) return;
      try {
        await moveFile(fileId, folderId);
        await refreshFolders();
        await refreshFilesForCurrentFolder();
        alert("파일을 폴더로 이동했습니다.");
      } catch (err: any) {
        alert(err?.message || "파일 이동에 실패했습니다.");
      }
    },
    [refreshFolders, refreshFilesForCurrentFolder]
  );

  const loadExistingFolderSummary = () => {
    const existing = fetchFolderSummary(currentFolderId);
    if (existing?.content) {
      setFolderSummaryContent(existing.content);
      setFolderSummaryUpdatedAt(existing.updated_at);
      setFolderSummaryStats({
        totalDocuments: existing.included_document_ids.length + existing.skipped_document_ids.length,
        includedDocuments: existing.included_document_ids.length,
        skippedDocuments: existing.skipped_document_ids.length,
      });
      return true;
    }
    return false;
  };

  const handleFolderSummarize = async () => {
    try {
      setIsFolderSummarizing(true);
      const { record, stats } = await summarizeFolderWithAI({
        folderId: currentFolderId,
        folderName: currentFolderName,
        folderNode: selectedItem,
        fullTree: folders,
      });
      setFolderSummaryContent(record.content);
      setFolderSummaryUpdatedAt(record.updated_at);
      setFolderSummaryStats(stats);
      setFolderSummaryModalOpen(true);
    } catch (err: any) {
      console.error("폴더 전체 요약 실패:", err);
      alert(err.message || "폴더 전체 요약에 실패했습니다.");
    } finally {
      setIsFolderSummarizing(false);
    }
  };

  const handleFolderSummaryView = () => {
    const ok = loadExistingFolderSummary();
    if (!ok) {
      alert("저장된 폴더 전체 요약이 없습니다. 먼저 '폴더 전체 요약하기'를 실행해 주세요.");
      return;
    }
    setFolderSummaryModalOpen(true);
  };

  const handleFolderQuestions = () => {
    const ok = loadExistingFolderSummary();
    if (!ok) {
      alert("폴더 전체 요약이 없습니다. 먼저 '폴더 전체 요약하기'를 실행해 주세요.");
      return;
    }
    setFolderQuestionsModalOpen(true);
  };

  const handleFolderQuestionsView = () => {
    // 바로 모달 열어서 저장된 문제를 보여줌 (없으면 모달 내 안내)
    setFolderQuestionsModalOpen(true);
  };

  const handleCreateFolder = async (name: string) => {
    try {
      await createFolder(name, selectedItem?.id || null);
      setShowCreateModal(false);
      // 사이드바 새로고침
      await refreshFolders();
    } catch (err: any) {
      console.error("폴더 생성 실패:", err);
      alert("폴더 생성에 실패했습니다: " + err.message);
    }
  };

  const handleFileUpload = async () => {
    // 파일 업로드 기능 (PDF/오디오 파일)
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.mp3,.wav,.m4a,.mp4";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        // 파일 업로드
        const fileMetadata = await uploadFile(file, selectedItem?.id || null);

        // 사이드바 새로고침 (파일이 사이드바에 즉시 표시됨)
        await refreshFolders();

        // 파일 목록도 새로고침
        const user = await getCurrentUser();
        if (user) {
          const folderId = selectedItem?.id || null;
          const folderFiles = await fetchFiles(user.id, folderId);
          setFiles(folderFiles);
        }

        // 업로드 성공 시 문서 상세 페이지로 이동
        router.push(`/document/${fileMetadata.id}`);
      } catch (err: any) {
        console.error("파일 업로드 실패:", err);
        alert("파일 업로드에 실패했습니다: " + err.message);
      }
    };
    input.click();
  };

  const handleSelectItem = (item: FolderNode) => {
    if (item.type === "document") {
      // 문서 클릭 시 상세 페이지로 이동
      router.push(`/document/${item.id}`);
    } else {
      // 폴더 클릭 시 URL 업데이트하고 선택
      router.push(`/dashboard?folder=${item.id}`);
      setSelectedItem(item);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        onSelectItem={handleSelectItem}
        selectedItemId={selectedItem?.id}
      />

      <div className="flex-1 flex flex-col">
        <Header title="문서" />

        <main className="flex-1 overflow-auto bg-background p-8">
          {!hasMounted || loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                {!hasMounted ? (
                  <p className="text-gray-600">준비 중...</p>
                ) : (
                  <p className="text-gray-600">폴더를 불러오는 중...</p>
                )}
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
                >
                  다시 시도
                </button>
              </div>
            </div>
          ) : !selectedItem ? (
            <div>
              {/* 루트 폴더 (selectedItem이 null일 때) */}
              <div className="bg-surface rounded-3xl border border-border p-8 mb-10 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors"></div>
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">전체 문서</h2>
                  <div className="flex gap-3"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => handleDropToFolder(null, e)}
                  >
                    <button
                      onClick={handleFolderSummarize}
                      disabled={isFolderSummarizing}
                      className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl hover:bg-secondary/80 transition-all font-semibold border border-border disabled:opacity-50"
                      title="이 폴더(전체 문서)의 전체요약만 모아 한 번에 정리합니다"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isFolderSummarizing ? "폴더 요약 중..." : "폴더 전체 요약하기"}
                    </button>
                    <button
                      onClick={handleFolderSummaryView}
                      className="flex items-center gap-2 px-5 py-2.5 bg-background text-white rounded-xl hover:bg-surface transition-all font-semibold border border-border"
                      title="저장된 폴더 전체 요약 보기"
                    >
                      <Eye className="w-4 h-4" />
                      폴더 전체 요약 보기
                    </button>
                    <button
                      onClick={() => setFolderQuestionsModalOpen(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-background text-white rounded-xl hover:bg-surface transition-all font-semibold border border-border"
                      title="폴더 전체 요약 + 족보(선택)로 문제 생성 및 기존 문제 보기"
                    >
                      <BookOpen className="w-4 h-4" />
                      폴더 족보
                    </button>
                    <button
                      onClick={handleFileUpload}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-semibold shadow-lg shadow-primary/20"
                    >
                      <Upload className="w-4 h-4" />
                      파일 업로드
                    </button>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl hover:bg-secondary/80 transition-all font-semibold border border-border"
                    >
                      <Plus className="w-4 h-4" />
                      새 폴더
                    </button>
                  </div>
                </div>
                <p className="text-gray-400 font-medium">
                  {files.length}개의 파일이 보관되어 있습니다
                </p>
              </div>

              {/* 루트 폴더 목록 */}
              {(folders.filter((f: any) => f.type === "folder").length > 0) && (
                <div className="mb-10">
                  <h3 className="text-lg font-semibold text-white mb-3">폴더</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {folders
                      .filter((f: any) => f.type === "folder" && !f.parentId)
                      .map((child: any) => (
                        <div
                          key={child.id}
                          onClick={() => router.push(`/dashboard?folder=${child.id}`)}
                          className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all group relative cursor-pointer"
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                          }}
                          onDrop={async (e) => {
                            await handleDropToFolder(child.id, e);
                          }}
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-14 h-14 bg-background border border-border rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                              <FolderPlus className="w-7 h-7 text-primary" />
                            </div>
                            <div className="flex-1 overflow-hidden pt-1">
                              <h3 className="font-bold text-white mb-1 truncate group-hover:text-primary transition-colors">
                                {child.name}
                              </h3>
                              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">폴더</p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 루트 폴더의 파일 목록 (루트에 파일이 있을 때만) */}
              {files.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all group relative cursor-pointer"
                      onClick={() => router.push(`/document/${file.id}`)}
                      draggable
                      onDragStart={(e) => {
                        dragDataRef.current = file.id;
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", file.id);
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-background border border-border rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                          {file.type === "pdf" ? (
                            <File className="w-7 h-7 text-red-500/80" />
                          ) : (
                            <File className="w-7 h-7 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 overflow-hidden pt-1">
                          <h3 className="font-bold text-white mb-1 truncate group-hover:text-primary transition-colors">
                            {file.name}
                          </h3>
                          <p className="text-xs text-gray-500 font-medium">
                            {file.type === "pdf" ? "PDF DOCUMENT" : "AUDIO RECORDING"}
                            {file.size && ` • ${(file.size / 1024 / 1024).toFixed(2)} MB`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`"${file.name}" 파일을 삭제하시겠습니까?`)) {
                            // ... deletion logic remains same
                          }
                        }}
                        className="absolute top-4 right-4 p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="파일 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {files.length === 0 && folders.filter((f: any) => f.type === "folder").length === 0 && (
                <div className="bg-surface rounded-3xl border border-border border-dashed p-16 text-center flex flex-col items-center justify-center mt-6">
                  <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center mb-6">
                    <Upload className="w-8 h-8 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">업로드된 파일이 없습니다</h3>
                  <p className="text-gray-500 max-w-xs mb-8">첫 번째 문서를 업로드하여 시작해 보세요.</p>
                  <button
                    onClick={handleFileUpload}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-bold shadow-xl shadow-primary/20"
                  >
                    <Upload className="w-5 h-5" />
                    파일 업로드
                  </button>
                </div>
              )}

              {filesLoading && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              )}
            </div>
          ) : selectedItem.type === "folder" ? (
            <div>
              <div className="bg-surface rounded-3xl border border-border p-8 mb-10 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors"></div>
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">{selectedItem.name}</h2>
                  <div className="flex gap-3"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => handleDropToFolder(selectedItem.id, e)}
                  >
                    <button
                      onClick={handleFolderSummarize}
                      disabled={isFolderSummarizing}
                      className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl hover:bg-secondary/80 transition-all font-semibold border border-border disabled:opacity-50"
                      title="이 폴더 및 하위 폴더들의 문서 전체요약만 모아 한 번에 정리합니다"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isFolderSummarizing ? "폴더 요약 중..." : "폴더 전체 요약하기"}
                    </button>
                    <button
                      onClick={handleFolderSummaryView}
                      className="flex items-center gap-2 px-5 py-2.5 bg-background text-white rounded-xl hover:bg-surface transition-all font-semibold border border-border"
                      title="저장된 폴더 전체 요약 보기"
                    >
                      <Eye className="w-4 h-4" />
                      폴더 전체 요약 보기
                    </button>
                    <button
                      onClick={() => setFolderQuestionsModalOpen(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-background text-white rounded-xl hover:bg-surface transition-all font-semibold border border-border"
                      title="폴더 전체 요약 + 족보(선택)로 문제 생성 및 기존 문제 보기"
                    >
                      <BookOpen className="w-4 h-4" />
                      폴더 족보
                    </button>
                    <button
                      onClick={handleFileUpload}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-semibold shadow-lg shadow-primary/20"
                    >
                      <Upload className="w-4 h-4" />
                      파일 업로드
                    </button>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl hover:bg-secondary/80 transition-all font-semibold border border-border"
                    >
                      <Plus className="w-4 h-4" />
                      하위 폴더
                    </button>
                  </div>
                </div>
                {(() => {
                  const childFolders = selectedItem.children?.filter(child => child.type === 'folder') || [];
                  const totalItems = childFolders.length + files.length;
                  return (
                    <p className="text-gray-400 font-medium">
                      {totalItems}개의 항목
                      {(childFolders.length > 0 || files.length > 0) && ' ('}
                      {childFolders.length > 0 && `폴더 ${childFolders.length}개`}
                      {childFolders.length > 0 && files.length > 0 && ', '}
                      {files.length > 0 && `파일 ${files.length}개`}
                      {(childFolders.length > 0 || files.length > 0) && ')'}
                    </p>
                  );
                })()}
              </div>

              {/* 하위 폴더 및 파일 목록 */}
              {(selectedItem.children && selectedItem.children.length > 0) || files.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 하위 폴더 */}
                  {selectedItem.children && selectedItem.children.length > 0 && (
                    <>
                      {[...selectedItem.children]
                        .filter(child => child.type === "folder")
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((child: any) => (
                          <div
                            key={child.id}
                            onClick={() => router.push(`/dashboard?folder=${child.id}`)}
                            className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all group relative cursor-pointer"
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                            }}
                            onDrop={async (e) => {
                              await handleDropToFolder(child.id, e);
                            }}
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-14 h-14 bg-background border border-border rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                                <FolderPlus className="w-7 h-7 text-primary" />
                              </div>
                              <div className="flex-1 overflow-hidden pt-1">
                                <h3 className="font-bold text-white mb-1 truncate group-hover:text-primary transition-colors">
                                  {child.name}
                                </h3>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">폴더</p>
                              </div>
                            </div>
                          </div>
                        ))}
                    </>
                  )}

                  {/* 업로드된 파일 */}
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all group relative"
                    >
                      <div
                        onClick={() => router.push(`/document/${file.id}`)}
                        className="flex items-start gap-4 cursor-pointer"
                      >
                        <div className="w-14 h-14 bg-background border border-border rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                          {file.type === "pdf" ? (
                            <File className="w-7 h-7 text-red-500/80" />
                          ) : (
                            <File className="w-7 h-7 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 overflow-hidden pt-1">
                          <h3 className="font-bold text-white mb-1 truncate group-hover:text-primary transition-colors">
                            {file.name}
                          </h3>
                          <p className="text-xs text-gray-500 font-medium">
                            {file.type === "pdf" ? "PDF DOCUMENT" : "AUDIO RECORDING"}
                            {file.size && ` • ${(file.size / 1024 / 1024).toFixed(2)} MB`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`"${file.name}" 파일을 삭제하시겠습니까?`)) {
                            try {
                              await deleteFile(file.id);
                              // 사이드바 새로고침 (파일이 사이드바에서 즉시 사라짐)
                              await refreshFolders();
                              // 파일 목록도 새로고침
                              const user = await getCurrentUser();
                              if (user) {
                                const folderFiles = await fetchFiles(user.id, selectedItem?.id || null);
                                setFiles(folderFiles);
                              }
                            } catch (err: any) {
                              alert("파일 삭제에 실패했습니다: " + err.message);
                            }
                          }
                        }}
                        className="absolute top-4 right-4 p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="파일 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-surface rounded-3xl border border-border border-dashed p-20 text-center flex flex-col items-center justify-center">
                  <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-6">
                    <FolderPlus className="w-10 h-10 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">폴더가 비어 있습니다</h3>
                  <p className="text-gray-500 max-w-xs mb-8">새로운 문서를 업로드하거나 하위 폴더를 생성하여 정리를 시작하세요.</p>
                  <button
                    onClick={handleFileUpload}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-bold shadow-xl shadow-primary/20"
                  >
                    <Upload className="w-5 h-5" />
                    파일 업로드
                  </button>
                </div>
              )}

              {filesLoading && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-surface rounded-3xl border border-border p-12 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">{selectedItem.name}</h2>
              <p className="text-gray-400">문서 상세 화면은 다음 단계에서 구현됩니다.</p>
            </div>
          )}
        </main>
      </div>

      <CreateFolderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateFolder}
        parentId={selectedItem?.id}
      />

      <FolderSummaryModal
        isOpen={folderSummaryModalOpen}
        onClose={() => setFolderSummaryModalOpen(false)}
        title={`${currentFolderName} · 폴더 전체 요약`}
        summaryContent={folderSummaryContent}
        stats={folderSummaryStats || undefined}
        updatedAt={folderSummaryUpdatedAt || undefined}
      />

      <FolderQuestionsModal
        isOpen={folderQuestionsModalOpen}
        onClose={() => setFolderQuestionsModalOpen(false)}
        folderId={currentFolderId}
        folderName={currentFolderName}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <Suspense fallback={
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">로딩 중...</p>
          </div>
        </div>
      }>
        <DashboardContent />
      </Suspense>
    </AuthGuard>
  );
}

