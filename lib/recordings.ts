export interface RecordingMetadata {
  id: string;
  name: string;
  duration: number;
  size: number;
  createdAt: string;
  storagePath?: string;
  transcript?: string;
  notesSummary?: string;
}

export interface ProfessorNoteBySlide {
  slide_number: number;
  text: string;
}

const RECORDINGS_KEY = 'aone_recordings';
const PROFESSOR_NOTES_KEY = 'aone_professor_notes';

const getStoredItems = (key: string): any[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
};

const saveItems = (key: string, items: any[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(items));
};

export const saveRecordingMetadata = {
  load(documentId: string): RecordingMetadata[] {
    const all = getStoredItems(RECORDINGS_KEY);
    return all.filter((r) => r.documentId === documentId).map((r) => r.data);
  },

  save(documentId: string, data: RecordingMetadata) {
    const all = getStoredItems(RECORDINGS_KEY);
    const idx = all.findIndex((r) => r.documentId === documentId && r.data?.id === data.id);
    const row = { documentId, data };
    if (idx >= 0) all[idx] = row;
    else all.unshift(row);
    saveItems(RECORDINGS_KEY, all);
  },

  remove(documentId: string, recordingId: string) {
    const all = getStoredItems(RECORDINGS_KEY);
    const next = all.filter((r) => !(r.documentId === documentId && r.data?.id === recordingId));
    saveItems(RECORDINGS_KEY, next);
  },
};

export function saveProfessorNotesForSlides(
  documentId: string,
  recordingId: string,
  notes: Array<{ slide_number: number; text: string }>
) {
  const all = getStoredItems(PROFESSOR_NOTES_KEY);
  const now = new Date().toISOString();

  for (const n of notes) {
    const slide = Number(n.slide_number);
    const text = String(n.text || '').trim();
    if (!Number.isFinite(slide) || slide <= 0 || !text) continue;

    const idx = all.findIndex((x) => x.documentId === documentId && x.slide_number === slide);
    const row = {
      documentId,
      slide_number: slide,
      text,
      recordingId,
      updated_at: now,
    };
    if (idx >= 0) all[idx] = row;
    else all.push(row);
  }

  saveItems(PROFESSOR_NOTES_KEY, all);
}

export function fetchProfessorNotesMap(documentId: string): Map<number, string> {
  const all = getStoredItems(PROFESSOR_NOTES_KEY);
  const filtered = all.filter((x) => x.documentId === documentId);
  const map = new Map<number, string>();
  for (const row of filtered) {
    map.set(Number(row.slide_number), String(row.text || ''));
  }
  return map;
}


