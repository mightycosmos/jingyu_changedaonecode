import { FolderNode } from '@/contexts/FolderContext';

// LocalStorage Keys
const FOLDERS_KEY = 'aone_folders';
const FILES_KEY = 'aone_files';

// Helper to get from LocalStorage
const getStoredItems = (key: string): any[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
};

// Helper to save to LocalStorage
const saveItems = (key: string, items: any[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(items));
};

/**
 * DB에서 폴더 목록을 조회합니다.
 */
export async function fetchFolders(userId: string): Promise<FolderNode[]> {
  const folders = getStoredItems(FOLDERS_KEY);
  return folders.filter(f => f.user_id === userId && !f.deleted_at).map(folder => ({
    id: folder.id,
    name: folder.name,
    type: 'folder' as const,
    parent_id: folder.parent_id,
    created_at: folder.created_at,
    updated_at: folder.updated_at,
    children: [],
  }));
}

/**
 * DB에서 파일 목록을 조회합니다 (삭제되지 않은 파일만).
 */
export async function fetchFiles(userId: string): Promise<FolderNode[]> {
  const files = getStoredItems(FILES_KEY);
  return files.filter(f => f.user_id === userId && !f.deleted_at).map(file => ({
    id: file.id,
    name: file.name,
    type: 'document' as const,
    parent_id: file.folder_id,
    created_at: file.created_at,
  }));
}

/**
 * 폴더와 파일을 트리 구조로 변환합니다.
 */
export function buildFolderTree(folders: FolderNode[], files: FolderNode[]): FolderNode[] {
  const allItems: FolderNode[] = [...folders, ...files];
  const itemMap = new Map<string, FolderNode>();
  allItems.forEach(item => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  const rootItems: FolderNode[] = [];
  allItems.forEach(item => {
    const node = itemMap.get(item.id)!;
    if (!item.parent_id) {
      rootItems.push(node);
    } else {
      const parent = itemMap.get(item.parent_id);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      }
    }
  });

  const sortChildren = (items: FolderNode[]) => {
    items.forEach(item => {
      if (item.children) {
        item.children.sort((a, b) => {
          if (a.type === 'folder' && b.type === 'document') return -1;
          if (a.type === 'document' && b.type === 'folder') return 1;
          return a.name.localeCompare(b.name);
        });
        sortChildren(item.children);
      }
    });
  };

  sortChildren(rootItems);
  return rootItems;
}

/**
 * DB에 폴더를 생성합니다.
 */
export async function createFolderInDB(name: string, parentId: string | null, userId: string): Promise<FolderNode> {
  const folders = getStoredItems(FOLDERS_KEY);
  const newFolder = {
    id: crypto.randomUUID(),
    name: name.trim(),
    parent_id: parentId,
    user_id: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  folders.push(newFolder);
  saveItems(FOLDERS_KEY, folders);

  return {
    id: newFolder.id,
    name: newFolder.name,
    type: 'folder',
    parent_id: newFolder.parent_id,
    children: [],
    created_at: newFolder.created_at,
    updated_at: newFolder.updated_at,
  };
}

/**
 * DB에서 폴더를 수정합니다.
 */
export async function updateFolderInDB(id: string, newName: string): Promise<void> {
  const folders = getStoredItems(FOLDERS_KEY);
  const index = folders.findIndex(f => f.id === id);
  if (index >= 0) {
    folders[index].name = newName.trim();
    folders[index].updated_at = new Date().toISOString();
    saveItems(FOLDERS_KEY, folders);
  }
}

/**
 * DB에서 폴더를 소프트 삭제합니다.
 */
export async function deleteFolderInDB(id: string): Promise<void> {
  const folders = getStoredItems(FOLDERS_KEY);
  const files = getStoredItems(FILES_KEY);
  const now = new Date().toISOString();

  const markDeleted = (folderId: string) => {
    const fIdx = folders.findIndex(f => f.id === folderId);
    if (fIdx >= 0) folders[fIdx].deleted_at = now;

    // Mark files in this folder
    files.forEach(f => {
      if (f.folder_id === folderId) f.deleted_at = now;
    });

    // Mark subfolders
    folders.forEach(f => {
      if (f.parent_id === folderId) markDeleted(f.id);
    });
  };

  markDeleted(id);
  saveItems(FOLDERS_KEY, folders);
  saveItems(FILES_KEY, files);
}

/**
 * DB에서 파일을 소프트 삭제합니다.
 */
export async function deleteFileInDB(id: string): Promise<void> {
  const files = getStoredItems(FILES_KEY);
  const index = files.findIndex(f => f.id === id);
  if (index >= 0) {
    files[index].deleted_at = new Date().toISOString();
    saveItems(FILES_KEY, files);
  }
}

/**
 * DB에서 파일 이름을 수정합니다.
 */
export async function updateFileInDB(id: string, newName: string): Promise<void> {
  const files = getStoredItems(FILES_KEY);
  const index = files.findIndex(f => f.id === id);
  if (index >= 0) {
    files[index].name = newName.trim();
    saveItems(FILES_KEY, files);
  }
}

/**
 * DB에서 폴더의 parent_id를 업데이트합니다 (이동).
 */
export async function moveFolderInDB(id: string, newParentId: string | null): Promise<void> {
  const folders = getStoredItems(FOLDERS_KEY);
  const index = folders.findIndex(f => f.id === id);
  if (index >= 0) {
    folders[index].parent_id = newParentId;
    folders[index].updated_at = new Date().toISOString();
    saveItems(FOLDERS_KEY, folders);
  }
}

/**
 * DB에서 파일의 folder_id를 업데이트합니다 (이동).
 */
export async function moveFileInDB(id: string, newFolderId: string | null): Promise<void> {
  const files = getStoredItems(FILES_KEY);
  const index = files.findIndex(f => f.id === id);
  if (index >= 0) {
    files[index].folder_id = newFolderId;
    saveItems(FILES_KEY, files);
  }
}

/**
 * DB에서 삭제된 폴더 목록을 조회합니다 (하위 항목 포함).
 */
export async function fetchDeletedFolders(userId: string): Promise<FolderNode[]> {
  const folders = getStoredItems(FOLDERS_KEY);
  const files = getStoredItems(FILES_KEY);

  const deletedFolders = folders.filter(f => f.user_id === userId && f.deleted_at);
  const deletedFiles = files.filter(f => f.user_id === userId && f.deleted_at);

  const allDeletedNodes = [
    ...deletedFolders.map(f => ({
      id: f.id,
      name: f.name,
      type: 'folder' as const,
      parent_id: f.parent_id,
      created_at: f.created_at,
      deleted_at: f.deleted_at,
      children: [],
    })),
    ...deletedFiles.map(f => ({
      id: f.id,
      name: f.name,
      type: 'document' as const,
      parent_id: f.folder_id,
      created_at: f.created_at,
      deleted_at: f.deleted_at,
    }))
  ];

  // Logic to build a partial tree for deleted items
  return buildFolderTree(
    allDeletedNodes.filter(n => n.type === 'folder'),
    allDeletedNodes.filter(n => n.type === 'document')
  );
}

/**
 * DB에서 폴더를 복구합니다.
 */
export async function restoreFolderInDB(id: string): Promise<void> {
  const folders = getStoredItems(FOLDERS_KEY);
  const files = getStoredItems(FILES_KEY);

  const restore = (folderId: string) => {
    const fIdx = folders.findIndex(f => f.id === folderId);
    if (fIdx >= 0) folders[fIdx].deleted_at = null;

    files.forEach(f => {
      if (f.folder_id === folderId) f.deleted_at = null;
    });

    folders.forEach(f => {
      if (f.parent_id === folderId) restore(f.id);
    });
  };

  restore(id);
  saveItems(FOLDERS_KEY, folders);
  saveItems(FILES_KEY, files);
}

/**
 * DB에서 폴더를 영구 삭제합니다.
 */
export async function permanentlyDeleteFolderInDB(id: string): Promise<void> {
  const folders = getStoredItems(FOLDERS_KEY);
  const files = getStoredItems(FILES_KEY);

  const remove = (folderId: string) => {
    const fIdx = folders.findIndex(f => f.id === folderId);
    if (fIdx >= 0) folders.splice(fIdx, 1);

    const fToRem = files.filter(f => f.folder_id === folderId).map(f => f.id);
    fToRem.forEach(fid => {
      const idx = files.findIndex(f => f.id === fid);
      if (idx >= 0) files.splice(idx, 1);
    });

    const subFolders = folders.filter(f => f.parent_id === folderId).map(f => f.id);
    subFolders.forEach(sfid => remove(sfid));
  };

  remove(id);
  saveItems(FOLDERS_KEY, folders);
  saveItems(FILES_KEY, files);
}

/**
 * DB에서 삭제된 파일 목록을 조회합니다.
 */
export async function fetchDeletedFiles(userId: string): Promise<FolderNode[]> {
  const files = getStoredItems(FILES_KEY);
  return files.filter(f => f.user_id === userId && f.deleted_at).map(file => ({
    id: file.id,
    name: file.name,
    type: 'document' as const,
    parent_id: file.folder_id,
    created_at: file.created_at,
    updated_at: file.deleted_at,
  }));
}

/**
 * DB에서 파일을 복구합니다.
 */
export async function restoreFileInDB(id: string): Promise<void> {
  const files = getStoredItems(FILES_KEY);
  const index = files.findIndex(f => f.id === id);
  if (index >= 0) {
    files[index].deleted_at = null;
    saveItems(FILES_KEY, files);
  }
}

/**
 * DB에서 파일을 영구 삭제합니다.
 */
export async function permanentlyDeleteFileInDB(id: string): Promise<void> {
  const files = getStoredItems(FILES_KEY);
  const index = files.findIndex(f => f.id === id);
  if (index >= 0) {
    files.splice(index, 1);
    saveItems(FILES_KEY, files);
  }
}

