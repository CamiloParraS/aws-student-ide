import { Fragment, ReactNode } from "react";

interface Props {
  text: string;
  onApplyCode?: (code: string) => void;
}

/** Tiny renderer: fenced code blocks, headings, lists, **bold**, _italic_, `code`. */
export default function Markdown({ text, onApplyCode }: Props) {
  const parts = text.split(/(```[\s\S]*?(?:```|$))/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const m = part.match(/^```([\w+#-]*)\n?([\s\S]*?)(?:```)?$/);
          const lang = m?.[1] ?? "";
          const code = (m?.[2] ?? "").replace(/\n$/, "");
          const closed = part.endsWith("```") && part.length > 3;
          return (
            <div className="codeblock" key={i}>
              <div className="codeblock-bar">
                <span>{lang || "code"}</span>
                <span className="codeblock-actions">
                  <button onClick={() => navigator.clipboard?.writeText(code)}>Copiar</button>
                  {onApplyCode && closed && <button onClick={() => onApplyCode(code)}>Aplicar al editor</button>}
                </span>
              </div>
              <pre>
                <code>{code}</code>
              </pre>
            </div>
          );
        }
        return <Fragment key={i}>{renderBlocks(part)}</Fragment>;
      })}
    </>
  );
}

function renderBlocks(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={`ul${out.length}`}>
          {list.map((li, i) => (
            <li key={i}>{inline(li)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  src.split("\n").forEach((line, i) => {
    const li = line.match(/^\s*[-*]\s+(.*)/);
    if (li) return void list.push(li[1]);
    flush();
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) out.push(<h4 key={i}>{inline(h[2])}</h4>);
    else if (line.trim()) out.push(<p key={i}>{inline(line)}</p>);
  });
  flush();
  return out;
}

function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g).map((t, i) => {
    if (t.startsWith("**") && t.endsWith("**") && t.length > 4) return <strong key={i}>{t.slice(2, -2)}</strong>;
    if (t.startsWith("`") && t.endsWith("`") && t.length > 2) return <code key={i}>{t.slice(1, -1)}</code>;
    if (t.startsWith("_") && t.endsWith("_") && t.length > 2) return <em key={i}>{t.slice(1, -1)}</em>;
    return t;
  });
}
