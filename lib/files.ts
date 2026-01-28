import { getCurrentUser } from './auth';

export interface FileMetadata {
  id: string;
  folder_id: string;
  type: 'pdf' | 'audio';
  storage_path: string;
  name: string;
  size?: number;
  duration?: number;
  page_count?: number;
  user_id: string;
  created_at: string;
  deleted_at?: string | null;
}

// LocalStorage Keys
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
 * 파일을 실제 벡엔드로 업로드합니다.
 */
export async function uploadFileToStorage(
  file: File,
  userId: string,
  folderId: string | null
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '파일 업로드에 실패했습니다.');
  }

  const data = await response.json();
  return data.url; // e.g., /uploads/123-filename.pdf
}

/**
 * 파일 메타데이터를 LocalStorage에 저장합니다.
 */
export async function saveFileMetadata(
  file: File,
  storagePath: string,
  folderId: string | null,
  userId: string,
  additionalMetadata?: {
    duration?: number;
    page_count?: number;
  }
): Promise<FileMetadata> {
  const fileType = file.type;
  let type: 'pdf' | 'audio';

  if (fileType === 'application/pdf') {
    type = 'pdf';
  } else if (fileType.startsWith('audio/')) {
    type = 'audio';
  } else {
    throw new Error('지원하지 않는 파일 형식입니다.');
  }

  const fileName = file.name.replace(/\.[^/.]+$/, '');
  const files = getStoredItems(FILES_KEY);

  const newFile: FileMetadata = {
    id: crypto.randomUUID(),
    folder_id: folderId || '',
    type: type,
    storage_path: storagePath,
    name: fileName,
    size: file.size,
    duration: additionalMetadata?.duration,
    page_count: additionalMetadata?.page_count,
    user_id: userId,
    created_at: new Date().toISOString(),
    deleted_at: null,
  };

  files.push(newFile);
  saveItems(FILES_KEY, files);

  return newFile;
}

/**
 * 파일 업로드 시뮬레이션
 */
export async function uploadFile(
  file: File,
  folderId: string | null
): Promise<FileMetadata> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const storagePath = await uploadFileToStorage(file, user.id, folderId);
  const fileMetadata = await saveFileMetadata(file, storagePath, folderId, user.id);

  return fileMetadata;
}

/**
 * 파일 목록 조회
 */
export async function fetchFiles(userId: string, folderId?: string | null): Promise<FileMetadata[]> {
  const files = getStoredItems(FILES_KEY);
  let result = files.filter(f => f.user_id === userId && !f.deleted_at);

  if (folderId !== undefined) {
    if (folderId === null || folderId === '') {
      result = result.filter(f => !f.folder_id);
    } else {
      result = result.filter(f => f.folder_id === folderId);
    }
  }

  return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * 파일 소프트 삭제
 */
export async function deleteFile(fileId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const files = getStoredItems(FILES_KEY);
  const index = files.findIndex(f => f.id === fileId);

  if (index === -1) throw new Error('파일을 찾을 수 없습니다.');
  if (files[index].user_id !== user.id) throw new Error('권한이 없습니다.');

  files[index].deleted_at = new Date().toISOString();
  saveItems(FILES_KEY, files);
}

/**
 * 파일 복구
 */
export async function restoreFile(fileId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const files = getStoredItems(FILES_KEY);
  const index = files.findIndex(f => f.id === fileId);

  if (index === -1) throw new Error('파일을 찾을 수 없습니다.');
  files[index].deleted_at = null;
  saveItems(FILES_KEY, files);
}

/**
 * 파일 영구 삭제
 */
export async function permanentlyDeleteFile(fileId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const files = getStoredItems(FILES_KEY);
  const index = files.findIndex(f => f.id === fileId);

  if (index !== -1) {
    files.splice(index, 1);
    saveItems(FILES_KEY, files);
  }
}

/**
 * 실제 파일 URL 반환
 */
export async function getFileUrl(storagePath: string): Promise<string> {
  // storagePath 자체가 /uploads/... 형태이므로 그대로 반환
  return storagePath;
}

/**
 * 삭제된 파일 목록 조회
 */
export async function fetchDeletedFiles(userId: string): Promise<FileMetadata[]> {
  const files = getStoredItems(FILES_KEY);
  return files.filter(f => f.user_id === userId && f.deleted_at);
}

export async function moveFile(fileId: string, targetFolderId: string | null): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const files = getStoredItems(FILES_KEY);
  const index = files.findIndex(f => f.id === fileId);

  if (index === -1) throw new Error('파일을 찾을 수 없습니다.');
  if (files[index].user_id !== user.id) throw new Error('권한이 없습니다.');

  files[index].folder_id = targetFolderId || '';
  files[index].updated_at = new Date().toISOString();
  saveItems(FILES_KEY, files);
}

