export function renderMarkdownPreview(markdown: string) {
  const rows = markdown.split("\n");
  return rows.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed)
      return <div key={`${idx}-spacer`} className="preview-spacer" />;
    if (trimmed.startsWith("### ")) {
      return <h4 key={idx}>{trimmed.replace("### ", "")}</h4>;
    }
    if (trimmed.startsWith("## ")) {
      return <h3 key={idx}>{trimmed.replace("## ", "")}</h3>;
    }
    if (trimmed.startsWith("# ")) {
      return <h2 key={idx}>{trimmed.replace("# ", "")}</h2>;
    }
    if (/^\d+\.\s/.test(trimmed)) {
      return (
        <p key={idx} className="preview-ordered">
          {trimmed}
        </p>
      );
    }
    if (trimmed.startsWith("- ")) {
      return (
        <p key={idx} className="preview-bullet">
          {trimmed.replace("- ", "• ")}
        </p>
      );
    }
    return <p key={idx}>{trimmed}</p>;
  });
}
