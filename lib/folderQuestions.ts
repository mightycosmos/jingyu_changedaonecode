export interface FolderQuestionsHistoryEntry {
  id: string;
  created_at: string;
  questions: any[];
  jokbo_text?: string;
}

export interface FolderQuestionsRecord {
  folder_id: string;
  history: FolderQuestionsHistoryEntry[];
}

const FOLDER_QUESTIONS_KEY = 'aone_folder_questions';

const getStoredItems = (key: string): any[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
};

const saveItems = (key: string, items: any[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(items));
};

export function fetchFolderQuestions(folderId: string): FolderQuestionsRecord | null {
  const all = getStoredItems(FOLDER_QUESTIONS_KEY);
  const found = all.find((q: any) => q.folder_id === folderId);

  // 구버전(단일 questions) 호환: history로 변환
  if (found && !Array.isArray(found.history) && Array.isArray(found.questions)) {
    const created = found.updated_at || new Date().toISOString();
    return {
      folder_id: found.folder_id,
      history: [
        {
          id: `${found.folder_id}-${created}`,
          created_at: created,
          questions: found.questions,
          jokbo_text: found.jokbo_text || '',
        },
      ],
    };
  }

  return found || null;
}

export function saveFolderQuestions(record: FolderQuestionsRecord) {
  const all = getStoredItems(FOLDER_QUESTIONS_KEY);
  const idx = all.findIndex((q: any) => q.folder_id === record.folder_id);
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  saveItems(FOLDER_QUESTIONS_KEY, all);
}

export function appendFolderQuestions(folderId: string, entry: FolderQuestionsHistoryEntry) {
  const existing = fetchFolderQuestions(folderId);
  const history = existing?.history || [];
  const next: FolderQuestionsRecord = {
    folder_id: folderId,
    history: [...history, entry],
  };
  saveFolderQuestions(next);
  return next;
}


