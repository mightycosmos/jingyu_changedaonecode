"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getCurrentUser } from "@/lib/auth";
import {
  fetchFolders,
  fetchFiles,
  buildFolderTree,
  createFolderInDB,
  updateFolderInDB,
  deleteFolderInDB,
  deleteFileInDB,
  updateFileInDB,
  moveFolderInDB,
  moveFileInDB,
  fetchDeletedFolders,
  restoreFolderInDB,
  permanentlyDeleteFolderInDB,
  restoreFileInDB,
  permanentlyDeleteFileInDB,
} from "@/lib/folders";

export interface FolderNode {
  id: string;
  name: string;
  type: "folder" | "document";
  parent_id?: string | null;
  children?: FolderNode[];
  created_at?: string;
  updated_at?: string;
}

interface FolderContextType {
  folders: FolderNode[];
  loading: boolean;
  error: string | null;
  createFolder: (name: string, parentId?: string | null) => Promise<FolderNode>;
  deleteFolder: (id: string) => Promise<void>;
  updateFolder: (id: string, newName: string) => Promise<void>;
  createDocument: (name: string, parentId?: string | null) => FolderNode;
  deleteDocument: (id: string) => Promise<void>;
  updateDocument: (id: string, newName: string) => Promise<void>;
  moveItem: (itemId: string, newParentId: string | null) => Promise<void>;
  moveItemBefore: (itemId: string, targetId: string) => void;
  findItemById: (id: string) => FolderNode | null;
  getFlatItems: () => FolderNode[];
  refreshFolders: () => Promise<void>;
  restoreFolder: (id: string) => Promise<void>;
  permanentlyDeleteFolder: (id: string) => Promise<void>;
  restoreFile: (id: string) => Promise<void>;
  permanentlyDeleteFile: (id: string) => Promise<void>;
  getDeletedFolders: () => Promise<FolderNode[]>;
}

const FolderContext = createContext<FolderContextType | undefined>(undefined);

export function FolderProvider({ children }: { children: React.ReactNode }) {
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // 사용자 정보 가져오기 및 초기 데이터 로드
  useEffect(() => {
    loadUserAndFolders();
  }, []);

  const loadUserAndFolders = async () => {
    try {
      setLoading(true);
      setError(null);

      const user = await getCurrentUser();
      if (!user) {
        setError("로그인이 필요합니다.");
        setLoading(false);
        return;
      }

      setUserId(user.id);
      await refreshFolders(user.id);
    } catch (err: any) {
      console.error("Error loading folders:", err);
      setError(err.message || "폴더를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // DB에서 폴더/파일 조회 및 트리 구조로 변환
  const refreshFolders = useCallback(async (currentUserId?: string) => {
    const uid = currentUserId || userId;
    if (!uid) return;

    try {
      const [foldersData, filesData] = await Promise.all([
        fetchFolders(uid),
        fetchFiles(uid),
      ]);

      const tree = buildFolderTree(foldersData, filesData);
      setFolders(tree);
      setError(null);
    } catch (err: any) {
      console.error("Error refreshing folders:", err);
      setError(err.message || "폴더를 불러오는 중 오류가 발생했습니다.");
    }
  }, [userId]);

  // 트리 구조에서 특정 ID의 아이템 찾기 (재귀)
  const findItemInTree = useCallback(
    (items: FolderNode[], id: string): FolderNode | null => {
      for (const item of items) {
        if (item.id === id) return item;
        if (item.children) {
          const found = findItemInTree(item.children, id);
          if (found) return found;
        }
      }
      return null;
    },
    []
  );

  // 트리 구조에서 아이템 찾고 업데이트
  const updateItemInTree = useCallback(
    (
      items: FolderNode[],
      id: string,
      updater: (item: FolderNode) => FolderNode
    ): FolderNode[] => {
      return items.map((item) => {
        if (item.id === id) {
          return updater(item);
        }
        if (item.children) {
          return {
            ...item,
            children: updateItemInTree(item.children, id, updater),
          };
        }
        return item;
      });
    },
    []
  );

  // 트리 구조에서 아이템 삭제
  const deleteItemInTree = useCallback(
    (items: FolderNode[], id: string): FolderNode[] => {
      return items
        .filter((item) => item.id !== id)
        .map((item) => {
          if (item.children) {
            return {
              ...item,
              children: deleteItemInTree(item.children, id),
            };
          }
          return item;
        });
    },
    []
  );

  // 특정 부모 아래에 아이템 추가
  const addItemToParent = useCallback(
    (
      items: FolderNode[],
      parentId: string | null | undefined,
      newItem: FolderNode
    ): FolderNode[] => {
      if (!parentId) {
        return [...items, newItem];
      }

      return items.map((item) => {
        if (item.id === parentId) {
          return {
            ...item,
            children: [...(item.children || []), newItem],
          };
        }
        if (item.children) {
          return {
            ...item,
            children: addItemToParent(item.children, parentId, newItem),
          };
        }
        return item;
      });
    },
    []
  );

  // 폴더 생성
  const createFolder = useCallback(
    async (name: string, parentId?: string | null): Promise<FolderNode> => {
      if (!userId) throw new Error("로그인이 필요합니다.");

      try {
        const newFolder = await createFolderInDB(name, parentId || null, userId);

        // 로컬 상태 업데이트
        setFolders((prev) => addItemToParent(prev, parentId, newFolder));

        return newFolder;
      } catch (err: any) {
        console.error("Error creating folder:", err);
        throw err;
      }
    },
    [userId, addItemToParent]
  );

  // 폴더 삭제
  const deleteFolder = useCallback(
    async (id: string): Promise<void> => {
      try {
        await deleteFolderInDB(id);

        // 로컬 상태 업데이트
        setFolders((prev) => deleteItemInTree(prev, id));
      } catch (err: any) {
        console.error("Error deleting folder:", err);
        throw err;
      }
    },
    [deleteItemInTree]
  );

  // 폴더 이름 변경
  const updateFolder = useCallback(
    async (id: string, newName: string): Promise<void> => {
      try {
        await updateFolderInDB(id, newName);

        // 로컬 상태 업데이트
        setFolders((prev) =>
          updateItemInTree(prev, id, (item) => ({
            ...item,
            name: newName,
            updated_at: new Date().toISOString(),
          }))
        );
      } catch (err: any) {
        console.error("Error updating folder:", err);
        throw err;
      }
    },
    [updateItemInTree]
  );

  // 문서 생성 (임시 - 파일 업로드 기능 구현 시 변경)
  const createDocument = useCallback(
    (name: string, parentId?: string | null): FolderNode => {
      const newDocument: FolderNode = {
        id: `temp-${Date.now()}`,
        name,
        type: "document",
        parent_id: parentId || null,
        created_at: new Date().toISOString(),
      };

      // 로컬 상태에만 추가 (실제 파일 업로드 시 DB에 저장)
      setFolders((prev) => addItemToParent(prev, parentId, newDocument));

      return newDocument;
    },
    [addItemToParent]
  );

  // 문서 삭제
  const deleteDocument = useCallback(
    async (id: string): Promise<void> => {
      try {
        await deleteFileInDB(id);

        // 로컬 상태 업데이트
        setFolders((prev) => deleteItemInTree(prev, id));
      } catch (err: any) {
        console.error("Error deleting document:", err);
        throw err;
      }
    },
    [deleteItemInTree]
  );

  // 문서 이름 변경
  const updateDocument = useCallback(
    async (id: string, newName: string): Promise<void> => {
      try {
        await updateFileInDB(id, newName);

        // 로컬 상태 업데이트
        setFolders((prev) =>
          updateItemInTree(prev, id, (item) => ({
            ...item,
            name: newName,
          }))
        );
      } catch (err: any) {
        console.error("Error updating document:", err);
        throw err;
      }
    },
    [updateItemInTree]
  );

  // ID로 아이템 찾기
  const findItemById = useCallback(
    (id: string): FolderNode | null => {
      return findItemInTree(folders, id);
    },
    [folders, findItemInTree]
  );

  // 아이템 이동 (부모 아래로)
  const moveItem = useCallback(
    async (itemId: string, newParentId: string | null): Promise<void> => {
      const item = findItemById(itemId);
      if (!item) return;

      // 순환 참조 방지
      if (newParentId === itemId) return;

      if (newParentId) {
        const newParent = findItemById(newParentId);
        if (!newParent || newParent.type !== "folder") return;

        // 하위 폴더인지 확인
        const isDescendant = (parentId: string, checkId: string): boolean => {
          const parent = findItemById(parentId);
          if (!parent || !parent.children) return false;
          return parent.children.some(
            (child) =>
              child.id === checkId ||
              (child.type === "folder" && isDescendant(child.id, checkId))
          );
        };

        if (isDescendant(itemId, newParentId)) return;
      }

      try {
        // DB 업데이트
        if (item.type === "folder") {
          await moveFolderInDB(itemId, newParentId);
        } else {
          await moveFileInDB(itemId, newParentId);
        }

        // 로컬 상태 업데이트
        const updatedFolders = deleteItemInTree(folders, itemId);
        const itemToMove = { ...item, parent_id: newParentId };
        const finalFolders = addItemToParent(updatedFolders, newParentId, itemToMove);
        setFolders(finalFolders);
      } catch (err: any) {
        console.error("Error moving item:", err);
        throw err;
      }
    },
    [folders, deleteItemInTree, addItemToParent, findItemById]
  );

  // 아이템을 타겟 아이템의 형제로 이동 (타겟 바로 다음/이전)
  const moveItemBefore = useCallback(
    (itemId: string, targetId: string) => {
      // TODO: DB에 순서 정보를 저장하는 컬럼이 필요하면 구현
      // 현재는 로컬 상태만 업데이트
      const item = findItemById(itemId);
      const target = findItemById(targetId);
      if (!item || !target) return;

      if (itemId === targetId) return;

      const targetParentId = target.parent_id || null;
      if (targetParentId === itemId) return;

      const updatedFolders = deleteItemInTree(folders, itemId);
      const itemToMove = { ...item, parent_id: targetParentId };

      if (targetParentId === null) {
        const targetIndex = updatedFolders.findIndex((f) => f.id === targetId);
        if (targetIndex !== -1) {
          const newFolders = [...updatedFolders];
          newFolders.splice(targetIndex + 1, 0, itemToMove);
          setFolders(newFolders);
        } else {
          setFolders([...updatedFolders, itemToMove]);
        }
      } else {
        // 하위 레벨 - 재귀적으로 찾아서 삽입
        const insertAtSibling = (items: FolderNode[]): FolderNode[] => {
          return items.map((folderItem) => {
            if (folderItem.id === targetParentId && folderItem.type === "folder") {
              const children = folderItem.children || [];
              const targetIndex = children.findIndex((c) => c.id === targetId);
              if (targetIndex !== -1) {
                const newChildren = [...children];
                newChildren.splice(targetIndex + 1, 0, itemToMove);
                return { ...folderItem, children: newChildren };
              }
              return { ...folderItem, children: [...children, itemToMove] };
            }
            if (folderItem.children) {
              return {
                ...folderItem,
                children: insertAtSibling(folderItem.children),
              };
            }
            return folderItem;
          });
        };
        setFolders(insertAtSibling(updatedFolders));
      }
    },
    [folders, deleteItemInTree, findItemById]
  );

  // 모든 아이템을 평면 배열로 반환
  const getFlatItems = useCallback((): FolderNode[] => {
    const flatten = (items: FolderNode[]): FolderNode[] => {
      const result: FolderNode[] = [];
      items.forEach((item) => {
        result.push(item);
        if (item.children) {
          result.push(...flatten(item.children));
        }
      });
      return result;
    };
    return flatten(folders);
  }, [folders]);

  // 삭제된 폴더 목록 조회
  const getDeletedFolders = useCallback(async (): Promise<FolderNode[]> => {
    // userId가 없으면 사용자 정보를 다시 가져오기 시도
    if (!userId) {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error("로그인이 필요합니다.");
      }
      setUserId(user.id);
      return await fetchDeletedFolders(user.id);
    }
    return await fetchDeletedFolders(userId);
  }, [userId]);

  // 폴더 복구
  const restoreFolder = useCallback(
    async (id: string): Promise<void> => {
      try {
        await restoreFolderInDB(id);
        // 폴더 목록 새로고침
        await refreshFolders();
      } catch (err: any) {
        console.error("Error restoring folder:", err);
        throw err;
      }
    },
    [refreshFolders]
  );

  // 폴더 영구 삭제
  const permanentlyDeleteFolder = useCallback(
    async (id: string): Promise<void> => {
      try {
        await permanentlyDeleteFolderInDB(id);
        // 폴더 목록 새로고침
        await refreshFolders();
      } catch (err: any) {
        console.error("Error permanently deleting folder:", err);
        throw err;
      }
    },
    [refreshFolders]
  );

  // 파일 복구
  const restoreFile = useCallback(
    async (id: string): Promise<void> => {
      try {
        await restoreFileInDB(id);
        // 폴더 목록 새로고침
        await refreshFolders();
      } catch (err: any) {
        console.error("Error restoring file:", err);
        throw err;
      }
    },
    [refreshFolders]
  );

  // 파일 영구 삭제
  const permanentlyDeleteFile = useCallback(
    async (id: string): Promise<void> => {
      try {
        await permanentlyDeleteFileInDB(id);
        // 폴더 목록 새로고침
        await refreshFolders();
      } catch (err: any) {
        console.error("Error permanently deleting file:", err);
        throw err;
      }
    },
    [refreshFolders]
  );

  return (
    <FolderContext.Provider
      value={{
        folders,
        loading,
        error,
        createFolder,
        deleteFolder,
        updateFolder,
        createDocument,
        deleteDocument,
        updateDocument,
        moveItem,
        moveItemBefore,
        findItemById,
        getFlatItems,
        refreshFolders,
        restoreFolder,
        permanentlyDeleteFolder,
        restoreFile,
        permanentlyDeleteFile,
        getDeletedFolders,
      }}
    >
      {children}
    </FolderContext.Provider>
  );
}

export function useFolders() {
  const context = useContext(FolderContext);
  if (context === undefined) {
    throw new Error("useFolders must be used within a FolderProvider");
  }
  return context;
}
