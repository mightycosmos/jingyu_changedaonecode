import { fetchFiles } from '@/lib/files';
import { getCurrentUser } from '@/lib/auth';
import type { FolderNode } from '@/contexts/FolderContext';

export interface FolderSummaryRecord {
  folder_id: string; // 'root' or actual folder id
  content: any; // TipTap JSON
  updated_at: string;
  included_document_ids: string[];
  skipped_document_ids: string[];
}

const FOLDER_SUMMARIES_KEY = 'aone_folder_full_summaries';

const getStoredItems = (key: string): any[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
};

const saveItems = (key: string, items: any[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(items));
};

export function fetchFolderSummary(folderId: string): FolderSummaryRecord | null {
  const all = getStoredItems(FOLDER_SUMMARIES_KEY);
  const found = all.find((s: any) => s.folder_id === folderId);
  return found || null;
}

export function saveFolderSummary(record: FolderSummaryRecord) {
  const all = getStoredItems(FOLDER_SUMMARIES_KEY);
  const idx = all.findIndex((s: any) => s.folder_id === record.folder_id);
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  saveItems(FOLDER_SUMMARIES_KEY, all);
}

export function tiptapToText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node.text === 'string') return node.text;
  const content = Array.isArray(node.content) ? node.content : [];
  const parts = content.map(tiptapToText).filter(Boolean);
  return parts.join(' ');
}

function isValidTipTapDoc(doc: any): boolean {
  return !!doc && doc.type === 'doc' && Array.isArray(doc.content) && doc.content.length > 0;
}

function collectFolderIdsFromNode(node: FolderNode): string[] {
  const ids: string[] = [];
  const walk = (n: FolderNode) => {
    if (n.type === 'folder') ids.push(n.id);
    (n.children || []).forEach(walk);
  };
  walk(node);
  return ids;
}

function collectAllFolderIdsFromTree(tree: FolderNode[]): string[] {
  const ids: string[] = [];
  const walk = (n: FolderNode) => {
    if (n.type === 'folder') ids.push(n.id);
    (n.children || []).forEach(walk);
  };
  tree.forEach(walk);
  return ids;
}

function getFullSummaryContentMap(): Map<string, any> {
  const fullSummaries = getStoredItems('aone_full_summaries');
  const map = new Map<string, any>();
  for (const s of fullSummaries) {
    if (s?.document_id) map.set(String(s.document_id), s.content);
  }
  return map;
}

export interface FolderSummaryInputStats {
  totalDocuments: number;
  includedDocuments: number;
  skippedDocuments: number;
}

/**
 * A안: 전체요약이 존재하는 문서만 모아 폴더 요약을 생성합니다.
 * - folderNode가 주어지면 해당 폴더 subtree 대상
 * - folderNode가 null이면 루트(전체 문서) 대상: 루트 파일(null) + 모든 폴더 subtree
 */
export async function summarizeFolderWithAI(opts: {
  folderId: string;
  folderName: string;
  folderNode: FolderNode | null;
  fullTree: FolderNode[];
}): Promise<{ content: any; record: FolderSummaryRecord; stats: FolderSummaryInputStats }> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const fullMap = getFullSummaryContentMap();

  const folderIds =
    opts.folderNode
      ? collectFolderIdsFromNode(opts.folderNode)
      : collectAllFolderIdsFromTree(opts.fullTree);

  // root view includes files with folderId null as well
  const folderIdsToFetch: Array<string | null> = opts.folderNode ? folderIds : [null, ...folderIds];

  // collect pdf documents under these folders
  const seen = new Set<string>();
  const docIds: string[] = [];

  for (const fid of folderIdsToFetch) {
    const files = await fetchFiles(user.id, fid);
    for (const f of files) {
      if (f.type !== 'pdf') continue;
      if (!seen.has(f.id)) {
        seen.add(f.id);
        docIds.push(f.id);
      }
    }
  }

  const included: string[] = [];
  const skipped: string[] = [];
  const sections: string[] = [];

  for (const id of docIds) {
    const tiptap = fullMap.get(id);
    const txt = tiptapToText(tiptap).trim();
    if (!txt) {
      skipped.push(id);
      continue;
    }
    included.push(id);
    sections.push(`Document ${id}:\n${txt}`);
  }

  if (included.length === 0) {
    throw new Error('이 폴더(및 하위 폴더)에서 전체요약이 존재하는 문서가 없습니다. 먼저 각 문서에서 전체요약을 생성해 주세요.');
  }

  const summariesText = sections.join('\n\n---\n\n');

  const res = await fetch('/api/summarize/folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folderName: opts.folderName,
      summariesText,
      includedCount: included.length,
      skippedCount: skipped.length,
    }),
  });

  if (!res.ok) {
    let message = `폴더 전체 요약에 실패했습니다. (HTTP ${res.status})`;
    try {
      const j = await res.json();
      const err = j?.error;
      const details = j?.details;
      message = err && details ? `${err} (${details})` : (err || details || message);
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await res.json();
  const content = data?.summary;

  if (!isValidTipTapDoc(content)) {
    throw new Error('폴더 요약 결과가 비어있습니다. 다시 시도해 주세요.');
  }

  const now = new Date().toISOString();
  const record: FolderSummaryRecord = {
    folder_id: opts.folderId,
    content,
    updated_at: now,
    included_document_ids: included,
    skipped_document_ids: skipped,
  };

  saveFolderSummary(record);

  return {
    content,
    record,
    stats: {
      totalDocuments: docIds.length,
      includedDocuments: included.length,
      skippedDocuments: skipped.length,
    },
  };
}


