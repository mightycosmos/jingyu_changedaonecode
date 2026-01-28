"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  Plus,
  MoreVertical,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { useFolders, FolderNode } from "@/contexts/FolderContext";
import CreateFolderModal from "@/components/modals/CreateFolderModal";
import ConfirmDeleteModal from "@/components/modals/ConfirmDeleteModal";
import FolderMenu from "@/components/layout/FolderMenu";
import { useEffect } from "react";
import { getCurrentUser, User } from "@/lib/auth";

interface SidebarProps {
  onSelectItem: (item: FolderNode) => void;
  selectedItemId?: string;
}

export default function Sidebar({ onSelectItem, selectedItemId }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { folders, createFolder, deleteFolder, updateFolder, createDocument, deleteDocument, updateDocument, moveItem, moveItemBefore } = useFolders();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [menuState, setMenuState] = useState<{
    item: FolderNode | null;
    position: { x: number; y: number };
  } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalParentId, setCreateModalParentId] = useState<string | null | undefined>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<FolderNode | null>(null);
  const [editingItem, setEditingItem] = useState<FolderNode | null>(null);
  const [editName, setEditName] = useState("");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setHasMounted(true);
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleCreateFolder = (parentId?: string | null) => {
    setCreateModalParentId(parentId);
    setShowCreateModal(true);
  };

  const handleCreateFolderSubmit = async (name: string) => {
    try {
      await createFolder(name, createModalParentId);
      setShowCreateModal(false);
      setCreateModalParentId(null);
    } catch (err: any) {
      console.error("폴더 생성 실패:", err);
      alert("폴더 생성에 실패했습니다: " + err.message);
    }
  };

  const handleMenuClick = (e: React.MouseEvent, item: FolderNode) => {
    e.stopPropagation();
    setMenuState({
      item,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleEdit = (item: FolderNode) => {
    setEditingItem(item);
    setEditName(item.name);
  };

  const handleEditSubmit = async () => {
    if (editingItem && editName.trim()) {
      try {
        if (editingItem.type === "folder") {
          await updateFolder(editingItem.id, editName.trim());
        } else {
          await updateDocument(editingItem.id, editName.trim());
        }
        setEditingItem(null);
        setEditName("");
      } catch (err: any) {
        console.error("이름 변경 실패:", err);
        alert("이름 변경에 실패했습니다: " + err.message);
      }
    }
  };

  const handleDelete = (item: FolderNode) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (itemToDelete) {
      try {
        if (itemToDelete.type === "folder") {
          await deleteFolder(itemToDelete.id);
        } else {
          await deleteDocument(itemToDelete.id);
        }
        if (selectedItemId === itemToDelete.id) {
          onSelectItem({} as FolderNode); // 선택 해제
        }
        setItemToDelete(null);
        setShowDeleteModal(false);
      } catch (err: any) {
        console.error("삭제 실패:", err);
        alert("삭제에 실패했습니다: " + err.message);
      }
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = "move";
    // 드래그 이미지 커스터마이징 (선택사항)
    if (e.dataTransfer.setDragImage) {
      const dragImage = document.createElement("div");
      dragImage.innerHTML = "이동 중...";
      dragImage.style.position = "absolute";
      dragImage.style.top = "-1000px";
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  };

  const handleDragOver = (e: React.DragEvent, itemId: string, itemType: "folder" | "document") => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    // 모든 아이템에 드롭 가능 (형제로 이동)
    if (draggedItemId && draggedItemId !== itemId) {
      setDragOverItemId(itemId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 마우스가 자식 요소로 이동한 경우가 아니면 드롭 타겟 해제
    const target = e.currentTarget as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!target.contains(relatedTarget)) {
      setDragOverItemId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetItemId: string, targetItemType: "folder" | "document") => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItemId || draggedItemId === targetItemId) {
      setDraggedItemId(null);
      setDragOverItemId(null);
      return;
    }

    try {
      // 타겟 아이템의 형제로 이동 (타겟 바로 다음에 위치)
      moveItemBefore(draggedItemId, targetItemId);

      setDraggedItemId(null);
      setDragOverItemId(null);
    } catch (err: any) {
      console.error("이동 실패:", err);
      alert("이동에 실패했습니다: " + err.message);
    }
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverItemId(null);
  };

  const renderFolderTree = (items: FolderNode[], level = 0, parentPath: boolean[] = []) => {
    // 폴더를 먼저, 문서를 나중에 정렬
    const sortedItems = [...items].sort((a, b) => {
      // 폴더가 문서보다 먼저 나오도록
      if (a.type === "folder" && b.type === "document") return -1;
      if (a.type === "document" && b.type === "folder") return 1;
      // 같은 타입이면 이름순으로 정렬
      return a.name.localeCompare(b.name);
    });

    return sortedItems.map((item, index) => {
      const isLast = index === sortedItems.length - 1;
      const currentPath = [...parentPath, !isLast];
      const isExpanded = expandedFolders.has(item.id);
      const isSelected = selectedItemId === item.id;
      const isHovered = hoveredItemId === item.id;
      const hasChildren = item.children && item.children.length > 0;

      const isDragging = draggedItemId === item.id;
      const isDragOver = dragOverItemId === item.id;

      return (
        <div key={item.id} className="relative">
          {/* 트리 구조 세로선 - 각 레벨마다 (항목 컨테이너 밖에 배치) */}
          {level > 0 && (
            <>
              {/* 부모 레벨들의 세로선 (형제가 있을 때만 아래로 이어짐) */}
              {parentPath.map((hasSibling, idx) => {
                if (!hasSibling) return null;
                return (
                  <div
                    key={`parent-${idx}-${item.id}`}
                    className="absolute top-0 bottom-0 w-[0.5px] bg-gray-300/30 pointer-events-none z-0"
                    style={{ left: `${12 + idx * 20 + 9.5}px` }}
                  />
                );
              })}
              {/* 현재 레벨의 세로선 (마지막 항목이 아닐 때만 아래로 이어짐) */}
              {!isLast && (
                <div
                  key={`current-${item.id}`}
                  className="absolute top-0 bottom-0 w-[0.5px] bg-gray-300/30 pointer-events-none z-0"
                  style={{ left: `${12 + (level - 1) * 20 + 9.5}px` }}
                />
              )}
              {/* 현재 항목 앞의 가로선 (세로선에서 아이콘까지) - "ㄱ"자 형태 */}
              <div
                key={`horizontal-${item.id}`}
                className="absolute top-[18px] h-[0.5px] bg-gray-300/30 pointer-events-none z-0"
                style={{
                  left: `${12 + (level - 1) * 20 + 9.5}px`,
                  width: `11px`
                }}
              />
            </>
          )}
          <div
            draggable
            onDragStart={(e) => handleDragStart(e, item.id)}
            onDragOver={(e) => handleDragOver(e, item.id, item.type)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, item.id, item.type)}
            onDragEnd={handleDragEnd}
            className={`
              relative flex items-center justify-between py-2 rounded-lg cursor-pointer transition-colors min-h-[36px] border-2
              ${isSelected ? "bg-primary/20 text-primary font-medium border-transparent" : "border-transparent text-gray-400"}
              ${isDragging ? "opacity-50" : ""}
              ${isDragOver ? "bg-primary/20 border-primary border-dashed" : ""}
              ${!isDragOver && !isSelected ? "hover:bg-white/5 hover:text-white" : ""}
            `}
            style={{
              paddingLeft: `${12 + level * 20}px`,
              paddingRight: '12px'
            }}
            onClick={() => {
              onSelectItem(item);
              // 폴더인 경우 클릭 시 확장/축소 토글
              if (item.type === "folder") {
                toggleFolder(item.id);
              }
            }}
            onMouseEnter={() => setHoveredItemId(item.id)}
            onMouseLeave={() => setHoveredItemId(null)}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0 relative z-10">
              {item.type === "folder" ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(item.id);
                  }}
                  className="p-0.5 hover:bg-white/10 rounded flex-shrink-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              ) : (
                // 문서의 경우 화살표 공간만큼 여백 추가 (정렬 맞추기)
                <div className="w-5 flex-shrink-0" />
              )}

              <div className="flex-shrink-0">
                {item.type === "folder" ? (
                  isExpanded ? (
                    <FolderOpen className="w-5 h-5 text-[#fbc02d]" />
                  ) : (
                    <Folder className="w-5 h-5 text-[#fbc02d]" />
                  )
                ) : (
                  <File className="w-5 h-5 text-primary" />
                )}
              </div>

              {editingItem?.id === item.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleEditSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleEditSubmit();
                    } else if (e.key === "Escape") {
                      setEditingItem(null);
                      setEditName("");
                    }
                  }}
                  className="text-sm text-white bg-background border border-primary rounded px-2 py-1 flex-1 min-w-0 placeholder:text-text-secondary"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className={`text-sm truncate flex-1 min-w-0 ${
                    isSelected ? "text-primary" : "text-white/90"
                  }`}
                >
                  {item.name}
                </span>
              )}
            </div>

            {isHovered && !editingItem && (
              <button
                onClick={(e) => handleMenuClick(e, item)}
                className="p-1 hover:bg-white/10 rounded flex-shrink-0 ml-2"
              >
                <MoreVertical className="w-4 h-4 text-text-secondary" />
              </button>
            )}
          </div>

          {item.type === "folder" && isExpanded && hasChildren && (
            <div>
              {renderFolderTree(item.children!, level + 1, currentPath)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="w-64 h-screen bg-sidebar border-r border-border flex flex-col">
      {/* 헤더 */}
      <div className="p-4 border-b border-border">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-2xl font-bold text-white hover:opacity-80 transition-opacity cursor-pointer flex items-center gap-2"
        >
          <span className="text-primary italic">A</span>one
        </button>
      </div>

      {/* 폴더 트리 */}
      <div
        className="flex-1 overflow-y-auto p-3"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (draggedItemId) {
            e.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          // 빈 영역에 드롭하는 경우는 루트 레벨의 끝에 추가
          if (draggedItemId) {
            try {
              await moveItem(draggedItemId, null); // 루트 레벨로 이동
            } catch (err: any) {
              console.error("이동 실패:", err);
              alert("이동에 실패했습니다: " + err.message);
            }
          }
          setDraggedItemId(null);
          setDragOverItemId(null);
        }}
      >
        <div className="mb-3">
          <div className="text-[10px] font-bold text-gray-500 uppercase px-3 mb-2 tracking-widest">
            문서
          </div>
          {renderFolderTree(folders)}
        </div>
      </div>

      {/* 하단 */}
      <div className="border-t border-border">
        <div className="p-4 text-center">
          <button
            onClick={() => handleCreateFolder(null)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            <span className="font-semibold text-sm">새 폴더</span>
          </button>
        </div>

        <div className="px-4 pb-2">
          <button
            onClick={() => router.push("/trash")}
            className={`w-full flex items-center gap-2 py-2 px-4 rounded-lg transition-colors ${pathname === "/trash" ? "bg-primary/20 text-primary" : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
          >
            <Trash2 className="w-4 h-4" />
            <span className="font-medium text-sm">휴지통</span>
          </button>
        </div>

        <div className="p-4 border-t border-border mt-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center text-white font-semibold">
              <UserIcon className="w-4 h-4 text-primary" />
            </div>
            {hasMounted && (
              <div className="flex-1 overflow-hidden">
                <div className="text-xs font-semibold text-white truncate">사용자</div>
                <div className="text-[10px] text-gray-500 truncate lowercase">
                  {user?.email || "guest@example.com"}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 모달들 */}
      <CreateFolderModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateModalParentId(null);
        }}
        onSubmit={handleCreateFolderSubmit}
        parentId={createModalParentId}
      />

      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        itemName={itemToDelete?.name || ""}
        itemType={itemToDelete?.type || "folder"}
      />

      {menuState && menuState.item && (
        <FolderMenu
          item={menuState.item}
          position={menuState.position}
          onClose={() => setMenuState(null)}
          onEdit={() => handleEdit(menuState.item!)}
          onDelete={() => handleDelete(menuState.item!)}
          onCreateFolder={() => handleCreateFolder(menuState.item!.id)}
          onCreateDocument={() => {
            // 문서 생성은 임시로 이름 입력 받아서 생성
            const name = prompt("문서 이름을 입력하세요:");
            if (name && name.trim()) {
              createDocument(name.trim(), menuState.item!.id);
            }
            setMenuState(null);
          }}
        />
      )}
    </div>
  );
}

