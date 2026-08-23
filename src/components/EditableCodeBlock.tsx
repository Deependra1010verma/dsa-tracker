import React, { useRef, useEffect } from "react";
import { parseSyntax } from "./SyntaxCodeBlock";
import "./EditableCodeBlock.css";

interface EditableCodeBlockProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minHeight?: number;
  language?: string;
}

export function EditableCodeBlock({
  value,
  onChange,
  placeholder = "Paste your core implementation code here...",
  minHeight = 200,
  language = "cpp",
}: EditableCodeBlockProps) {
  // We ensure the textarea and the pre have the exact same text,
  // with an extra newline at the end so the scroll area matches correctly.
  const previewContent = value.endsWith("\n") ? value + " " : value;

  const preRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-grow height based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    const container = containerRef.current;
    if (!textarea || !container) return;
    // Reset height to recalculate
    textarea.style.height = "auto";
    const newHeight = Math.max(textarea.scrollHeight, minHeight);
    textarea.style.height = `${newHeight}px`;
    container.style.height = `${newHeight}px`;
  }, [value, minHeight]);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  return (
    <div ref={containerRef} className="editable-code-block-container" style={{ minHeight }}>
      <pre ref={preRef} className="syntax-code-pre editable-code-preview" aria-hidden="true">
        <code className="editable-code-inner">{parseSyntax(previewContent || "")}</code>
      </pre>
      <textarea
        ref={textareaRef}
        className="editable-code-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        placeholder={placeholder}
        spellCheck="false"
      />
    </div>
  );
}
