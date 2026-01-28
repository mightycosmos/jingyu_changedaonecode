"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough,
  Palette,
  Highlighter,
  Type,
  List,
  ListOrdered
} from 'lucide-react';
import { useEffect } from 'react';

interface TipTapEditorProps {
  content: any; // TipTap JSON 형식
  onChange: (content: any) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
}

export default function TipTapEditor({
  content,
  onChange,
  placeholder = "내용을 입력하세요...",
  editable = true,
  className = "",
}: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        underline: false, // StarterKit의 underline 비활성화 (별도로 추가)
      }),
      Underline,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
    ],
    content: content || null,
    editable,
    immediatelyRender: false, // SSR hydration mismatch 방지
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
  });

  useEffect(() => {
    if (editor) {
      const currentContent = JSON.stringify(editor.getJSON());
      const newContent = JSON.stringify(content || null);
      if (currentContent !== newContent) {
        editor.commands.setContent(content || null);
      }
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={`border border-border rounded-lg bg-background text-white ${!editable ? "tiptap-readonly-dark" : ""} ${className}`}
    >
      {editable && (
        <div className="border-b border-border p-2 flex items-center gap-1 flex-wrap bg-surface text-white">
          {/* 텍스트 스타일 */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 rounded hover:bg-white/10 transition-colors ${
              editor.isActive('bold') ? 'bg-white/15' : ''
            }`}
            title="굵게"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 rounded hover:bg-white/10 transition-colors ${
              editor.isActive('italic') ? 'bg-white/15' : ''
            }`}
            title="기울임"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-2 rounded hover:bg-white/10 transition-colors ${
              editor.isActive('underline') ? 'bg-white/15' : ''
            }`}
            title="밑줄"
          >
            <UnderlineIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-2 rounded hover:bg-white/10 transition-colors ${
              editor.isActive('strike') ? 'bg-white/15' : ''
            }`}
            title="취소선"
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* 색상 */}
          <div className="relative group">
            <button
              type="button"
              className="p-2 rounded hover:bg-white/10 transition-colors"
              title="텍스트 색상"
            >
              <Palette className="w-4 h-4" />
            </button>
            <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-lg shadow-lg p-2 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="grid grid-cols-6 gap-1">
                {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => editor.chain().focus().setColor(color).run()}
                    className="w-6 h-6 rounded border border-border"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={`p-2 rounded hover:bg-white/10 transition-colors ${
              editor.isActive('highlight') ? 'bg-white/15' : ''
            }`}
            title="하이라이트"
          >
            <Highlighter className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* 제목 */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-2 rounded hover:bg-white/10 transition-colors ${
              editor.isActive('heading', { level: 1 }) ? 'bg-white/15' : ''
            }`}
            title="제목 1"
          >
            <Type className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* 리스트 */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded hover:bg-white/10 transition-colors ${
              editor.isActive('bulletList') ? 'bg-white/15' : ''
            }`}
            title="글머리 기호"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 rounded hover:bg-white/10 transition-colors ${
              editor.isActive('orderedList') ? 'bg-white/15' : ''
            }`}
            title="번호 매기기"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="p-4 min-h-[200px] relative bg-background text-white">
        <EditorContent 
          editor={editor} 
          className="max-w-none focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[150px] [&_.ProseMirror]:text-white [&_.ProseMirror]:bg-background [&_.ProseMirror]:caret-white [&_.ProseMirror_a]:text-primary [&_.ProseMirror_h1]:text-white [&_.ProseMirror_h2]:text-white [&_.ProseMirror_h3]:text-white [&_.ProseMirror_ul]:text-white [&_.ProseMirror_ol]:text-white"
        />
        {editable && editor.isEmpty && (
          <div className="text-text-secondary pointer-events-none absolute top-4 left-4">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

