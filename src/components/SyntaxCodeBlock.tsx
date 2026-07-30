import React, { useMemo } from "react";

interface SyntaxCodeBlockProps {
  code: string;
  language?: string;
}

export function SyntaxCodeBlock({ code, language = "cpp" }: SyntaxCodeBlockProps) {
  const highlightedTokens = useMemo(() => {
    return parseSyntax(code);
  }, [code]);

  return (
    <pre className="syntax-code-pre">
      <code>{highlightedTokens}</code>
    </pre>
  );
}

function parseSyntax(code: string): React.ReactNode[] {
  const tokenRegex =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)|("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|`[^`\\]*(?:\\.[`\\]*)*`)|(\b\d+(?:\.\d+)?\b)|(\b(?:auto|break|case|catch|class|const|continue|default|delete|do|else|enum|export|extern|for|friend|goto|if|inline|namespace|new|operator|private|protected|public|register|return|sizeof|static|struct|switch|template|this|throw|try|typedef|typeid|typename|union|using|virtual|volatile|while|def|import|from|as|lambda|pass|raise|yield|with|assert|async|await|let|var|function|val|in|is|nil|True|False|None)\b)|(\b(?:int|long|short|char|float|double|bool|void|unsigned|signed|size_t|uint64_t|int64_t|int32_t|string|vector|unordered_map|map|unordered_set|set|pair|queue|priority_queue|stack|deque|list|array|ListNode|TreeNode|self|print|range|len|enumerate|zip|min|max|sum|abs|nullptr|NULL|true|false)\b)|(\b[a-zA-Z_]\w*(?=\s*\())|(==|!=|<=|>=|&&|\|\||->|::|\+\+|--|\+=|-=|\*=|\/=|<<|>>|\+|-|\*|\/|%|=|<|>|!|&|\||\^|~|\?)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(code)) !== null) {
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      elements.push(code.substring(lastIndex, matchIndex));
    }

    const [
      fullMatch,
      comment,
      stringLit,
      numberLit,
      keyword,
      typeLit,
      funcName,
      operator,
    ] = match;

    let className = "";
    if (comment) className = "syn-comment";
    else if (stringLit) className = "syn-string";
    else if (numberLit) className = "syn-number";
    else if (keyword) className = "syn-keyword";
    else if (typeLit) className = "syn-type";
    else if (funcName) className = "syn-fn";
    else if (operator) className = "syn-operator";

    if (className) {
      elements.push(
        <span key={`${matchIndex}-${fullMatch.slice(0, 10)}`} className={className}>
          {fullMatch}
        </span>
      );
    } else {
      elements.push(fullMatch);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < code.length) {
    elements.push(code.substring(lastIndex));
  }

  return elements;
}
