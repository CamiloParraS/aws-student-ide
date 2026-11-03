import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types";
import Markdown from "./Markdown";

const QUICK = [
  { label: "Revisar código", prompt: "Revisa mi código y dime qué puedo mejorar." },
  { label: "Detectar errores", prompt: "Detecta errores (de sintaxis, lógica y casos borde) en mi código." },
  { label: "Explicar", prompt: "Explícame paso a paso qué hace mi código." },
];

interface Props {
  messages: ChatMessage[];
  busy: boolean;
  disabled: boolean;
  disabledReason?: string;
  onSend: (prompt: string) => void;
  onApplyCode: (code: string) => void;
}

export default function Chat({ messages, busy, disabled, disabledReason, onSend, onApplyCode }: Props) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const canSend = !busy && !disabled;

  const send = (text: string) => {
    if (!text.trim() || !canSend) return;
    onSend(text.trim());
    setInput("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="chat">
      <div className="messages" aria-live="polite">
        {messages.length === 0 && (
          <div className="empty">
            <p>Escribe código en el editor y pregúntame lo que necesites.</p>
            <div className="chips">
              {QUICK.map((q) => (
                <button key={q.label} disabled={!canSend} onClick={() => send(q.prompt)}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}${m.error ? " err" : ""}`}>
            <div className="who">{m.role === "user" ? "Tú" : "Asistente"}</div>
            <div className="bubble">
              {m.role === "assistant" ? <Markdown text={m.text} onApplyCode={onApplyCode} /> : <p>{m.text}</p>}
              {m.streaming && <span className="cursor" />}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {messages.length > 0 && (
        <div className="chips inline">
          {QUICK.map((q) => (
            <button key={q.label} disabled={!canSend} onClick={() => send(q.prompt)}>
              {q.label}
            </button>
          ))}
        </div>
      )}

      <form className="composer" onSubmit={submit}>
        <textarea
          rows={2}
          value={input}
          placeholder={disabled ? disabledReason : "Pregunta sobre tu código… (Enter envía, Shift+Enter nueva línea)"}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          disabled={disabled}
        />
        <button className="primary" disabled={!canSend || !input.trim()}>
          {busy ? "…" : "Enviar"}
        </button>
      </form>
    </div>
  );
}
