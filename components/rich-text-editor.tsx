"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  value: string;
  onChange: (html: string) => void;
}

const FONTS = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "Times New Roman, serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: "Courier New, monospace" },
  { label: "Trebuchet MS", value: "Trebuchet MS, sans-serif" },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
];

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px"];

const COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#ffffff",
  "#e6194b", "#f58231", "#ffe119", "#3cb44b", "#42d4f4", "#4363d8",
  "#911eb4", "#f032e6", "#a9a9a9", "#800000", "#9a6324", "#808000",
];

export default function RichTextEditor({ value, onChange }: Props) {
  const [showSource, setShowSource] = useState(false);
  const [sourceHtml, setSourceHtml] = useState(value);
  const isInternalRef = useRef(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      FontSize,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      Image.configure({ inline: true }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      isInternalRef.current = true;
      const html = editor.getHTML();
      onChange(html);
      setSourceHtml(html);
    },
    editorProps: {
      attributes: {
        class: "prose-editor",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (isInternalRef.current) {
      isInternalRef.current = false;
      return;
    }
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value, { emitUpdate: false });
      setSourceHtml(value);
    }
  }, [value, editor]);

  const toggleSource = useCallback(() => {
    if (!editor) return;
    if (showSource) {
      editor.commands.setContent(sourceHtml, { emitUpdate: false });
      onChange(sourceHtml);
    } else {
      setSourceHtml(editor.getHTML());
    }
    setShowSource(!showSource);
  }, [showSource, sourceHtml, editor, onChange]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = prompt("Link URL:");
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const addImageUrl = useCallback(() => {
    if (!editor) return;
    const url = prompt("Resim URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      alert("Resim yüklenemedi. Vercel Blob yapılandırmasını kontrol edin.");
    } finally {
      setUploading(false);
    }
  }, [editor]);

  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `p-1.5 rounded text-sm transition-colors ${active ? "bg-gray-600 text-blue-400" : "text-gray-400 hover:bg-gray-700 hover:text-gray-200"}`;

  return (
    <div className="border border-gray-700 rounded-lg bg-gray-800">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-700 bg-gray-850 relative">
        {/* Font Family */}
        <div className="relative">
          <button type="button" onClick={() => { setShowFontMenu(!showFontMenu); setShowSizeMenu(false); setShowColorPicker(false); setShowBgPicker(false); }}
            className="px-2 py-1 rounded text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700 min-w-[80px] text-left truncate">
            {FONTS.find(f => editor.isActive("textStyle", { fontFamily: f.value }))?.label || "Font"}
          </button>
          {showFontMenu && (
            <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[180px]">
              {FONTS.map(f => (
                <button key={f.value} type="button"
                  onClick={() => { editor.chain().focus().setFontFamily(f.value).run(); setShowFontMenu(false); }}
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-800 text-gray-300" style={{ fontFamily: f.value }}>
                  {f.label}
                </button>
              ))}
              <button type="button" onClick={() => { editor.chain().focus().unsetFontFamily().run(); setShowFontMenu(false); }}
                className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-800 text-gray-500 border-t border-gray-700">
                Varsayılan
              </button>
            </div>
          )}
        </div>

        {/* Font Size */}
        <div className="relative">
          <button type="button" onClick={() => { setShowSizeMenu(!showSizeMenu); setShowFontMenu(false); setShowColorPicker(false); setShowBgPicker(false); }}
            className="px-2 py-1 rounded text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700 min-w-[50px] text-left">
            {editor.getAttributes("textStyle").fontSize || "16px"}
          </button>
          {showSizeMenu && (
            <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1">
              {FONT_SIZES.map(s => (
                <button key={s} type="button"
                  onClick={() => { editor.chain().focus().setFontSize(s).run(); setShowSizeMenu(false); }}
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-800 text-gray-300">
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <Divider />

        {/* Text formatting */}
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive("bold"))} title="Kalın">
          <b>B</b>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive("italic"))} title="İtalik">
          <i>I</i>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btnClass(editor.isActive("underline"))} title="Altı çizili">
          <u>U</u>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btnClass(editor.isActive("strike"))} title="Üstü çizili">
          <s>S</s>
        </button>

        <Divider />

        {/* Text Color */}
        <div className="relative">
          <button type="button" onClick={() => { setShowColorPicker(!showColorPicker); setShowBgPicker(false); setShowFontMenu(false); setShowSizeMenu(false); }}
            className="p-1.5 rounded text-sm text-gray-400 hover:bg-gray-700 hover:text-gray-200" title="Yazı rengi">
            <span className="flex flex-col items-center">
              <span>A</span>
              <span className="w-4 h-1 rounded-sm" style={{ backgroundColor: editor.getAttributes("textStyle").color || "#ffffff" }} />
            </span>
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-30 p-3" style={{ width: 228 }}>
              <div className="grid grid-cols-6 gap-2">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => { editor.chain().focus().setColor(c).run(); setShowColorPicker(false); }}
                    className="w-7 h-7 rounded border border-gray-600 hover:scale-110 transition-transform cursor-pointer" style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Highlight */}
        <div className="relative">
          <button type="button" onClick={() => { setShowBgPicker(!showBgPicker); setShowColorPicker(false); setShowFontMenu(false); setShowSizeMenu(false); }}
            className="p-1.5 rounded text-sm text-gray-400 hover:bg-gray-700 hover:text-gray-200" title="Vurgu rengi">
            <span className="bg-yellow-400/30 px-1 rounded text-xs">A</span>
          </button>
          {showBgPicker && (
            <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-30 p-3" style={{ width: 228 }}>
              <div className="grid grid-cols-6 gap-2">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => { editor.chain().focus().toggleHighlight({ color: c }).run(); setShowBgPicker(false); }}
                    className="w-7 h-7 rounded border border-gray-600 hover:scale-110 transition-transform cursor-pointer" style={{ backgroundColor: c }} />
                ))}
                <button type="button" onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowBgPicker(false); }}
                  className="w-7 h-7 rounded border border-gray-600 hover:scale-110 transition-transform bg-gray-800 flex items-center justify-center text-[10px] text-gray-500 cursor-pointer">
                  X
                </button>
              </div>
            </div>
          )}
        </div>

        <Divider />

        {/* Alignment */}
        <button type="button" onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={btnClass(editor.isActive({ textAlign: "left" }))} title="Sola hizala">
          <AlignIcon lines={[16, 12, 14]} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={btnClass(editor.isActive({ textAlign: "center" }))} title="Ortala">
          <AlignIcon lines={[12, 16, 10]} center />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={btnClass(editor.isActive({ textAlign: "right" }))} title="Sağa hizala">
          <AlignIcon lines={[16, 12, 14]} right />
        </button>

        <Divider />

        {/* Lists */}
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btnClass(editor.isActive("bulletList"))} title="Madde listesi">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a1 1 0 100 2 1 1 0 000-2zm4 1a1 1 0 011-1h6a1 1 0 110 2H9a1 1 0 01-1-1zm0 5a1 1 0 011-1h6a1 1 0 110 2H9a1 1 0 01-1-1zm0 5a1 1 0 011-1h6a1 1 0 110 2H9a1 1 0 01-1-1zM4 9a1 1 0 100 2 1 1 0 000-2zm0 5a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btnClass(editor.isActive("orderedList"))} title="Numaralı liste">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4.5a.5.5 0 01.5-.5H4a.5.5 0 01.5.5v3h.5a.5.5 0 010 1h-2a.5.5 0 010-1H3v-3zm6 0a1 1 0 011-1h6a1 1 0 110 2H10a1 1 0 01-1-1zm0 5a1 1 0 011-1h6a1 1 0 110 2H10a1 1 0 01-1-1zm0 5a1 1 0 011-1h6a1 1 0 110 2H10a1 1 0 01-1-1z" /></svg>
        </button>

        <Divider />

        {/* Headings */}
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={btnClass(editor.isActive("heading", { level: 1 }))} title="Başlık 1">
          <span className="text-xs font-bold">H1</span>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btnClass(editor.isActive("heading", { level: 2 }))} title="Başlık 2">
          <span className="text-xs font-bold">H2</span>
        </button>

        <Divider />

        {/* Link & Image */}
        <button type="button" onClick={addLink} className={btnClass(editor.isActive("link"))} title="Link ekle">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </button>
        <div className="relative group">
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className={`${btnClass(false)} ${uploading ? "opacity-50" : ""}`} title="Resim yükle" disabled={uploading}>
            {uploading ? (
              <span className="text-xs animate-pulse">...</span>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }} />
        </div>
        <button type="button" onClick={addImageUrl} className={btnClass(false)} title="Resim URL'den ekle">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l-4 4" />
          </svg>
        </button>

        {/* HR */}
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btnClass(false)} title="Yatay çizgi">
          <span className="text-xs">—</span>
        </button>

        <div className="flex-1" />

        {/* Source toggle */}
        <button type="button" onClick={toggleSource}
          className={`px-2 py-1 rounded text-xs ${showSource ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-700 hover:text-gray-300"}`}>
          {"</>"}
        </button>
      </div>

      {/* Editor / Source */}
      {showSource ? (
        <textarea
          value={sourceHtml}
          onChange={e => setSourceHtml(e.target.value)}
          className="w-full p-3 bg-gray-800 text-sm font-mono resize-y focus:outline-none min-h-[200px] text-gray-300"
          rows={10}
        />
      ) : (
        <EditorContent editor={editor} className="prose-editor-wrapper" />
      )}
    </div>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-700 mx-0.5" />;
}

function AlignIcon({ lines, center, right }: { lines: number[]; center?: boolean; right?: boolean }) {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      {lines.map((w, i) => {
        const x = right ? 20 - w : center ? (20 - w) / 2 : 0;
        return <rect key={i} x={x} y={3 + i * 6} width={w} height={2} rx={1} />;
      })}
    </svg>
  );
}
