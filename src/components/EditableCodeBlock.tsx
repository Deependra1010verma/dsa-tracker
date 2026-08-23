import React, { useRef } from "react";
import { parseSyntax } from "./SyntaxCodeBlock";
import "./EditableCodeBlock.css";

interface EditableCodeBlockProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export function EditableCodeBlock({
  value,
  onChange,
  placeholder = "Paste your core implementation code here...",
  minHeight = 200,
}: EditableCodeBlockProps) {
  // We ensure the textarea and the pre have the exact same text, 
  // with an extra newline at the end so the scroll area matches correctly
  // even if the user types trailing newlines.
  const previewContent = value.endsWith("\n") ? value + " " : value;

  const preRef = useRef<HTMLPreElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  return (
    <div className="editable-code-block-container" style={{ minHeight }}>
      <pre ref={preRef} className="syntax-code-pre editable-code-preview" aria-hidden="true">
        <code className="editable-code-inner">{parseSyntax(previewContent || "")}</code>
      </pre>
      <textarea
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
