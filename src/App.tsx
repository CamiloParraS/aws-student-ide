import { useCallback, useEffect, useRef, useState } from "react";
import { restoreSession, signOut } from "./auth";
import { config } from "./config";
import { openSocket, Socket, SocketStatus } from "./socket";
import type { ChatMessage, IncomingFrame, User } from "./types";
import Chat from "./components/Chat";
import CodeEditor, { LANGUAGES } from "./components/CodeEditor";
import Login from "./components/Login";

const uid = () => crypto.randomUUID();

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    restoreSession().then((u) => {
      setUser(u);
      setChecking(false);
    });
  }, []);

  if (checking) return <div className="center muted">Cargando…</div>;
  if (!user) return <Login onLogin={setUser} />;
  return (
    <Workspace
      user={user}
      onLogout={() => {
        signOut();
        setUser(null);
      }}
    />
  );
}

function Workspace({ user, onLogout }: { user: User; onLogout: () => void }) {
  const key = (s: string) => `${s}:${user.sub}`;

  const [language, setLanguage] = useState<string>(() => loadJson(key("lang"), "python"));
  const [code, setCode] = useState<string>(
    () => loadJson<string | null>(key("code"), null) ?? LANGUAGES[0].sample,
  );
  const [sessionId, setSessionId] = useState<string>(() => loadJson(key("session"), "") || uid());
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadJson<ChatMessage[]>(key("msgs"), []).map((m) => ({ ...m, streaming: false })),
  );
  const [usage, setUsage] = useState(user.dailyUsage);
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [statusDetail, setStatusDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Persist locally (the authoritative history lives in DynamoDB).
  useEffect(() => saveJson(key("code"), code), [code]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => saveJson(key("lang"), language), [language]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => saveJson(key("session"), sessionId), [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!busy) saveJson(key("msgs"), messages.slice(-40));
  }, [messages, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFrame = useCallback((f: IncomingFrame) => {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (!last || last.role !== "assistant") return prev;
      if (f.type === "chunk") next[next.length - 1] = { ...last, text: last.text + f.text };
      else if (f.type === "done") next[next.length - 1] = { ...last, streaming: false };
      else {
        const msg =
          f.code === 429 ? "Alcanzaste el límite diario de consultas." : f.message || "Error del servidor.";
        next[next.length - 1] = { ...last, text: last.text || msg, streaming: false, error: true };
      }
      return next;
    });
    if (f.type === "done") {
      setBusy(false);
      if (typeof f.dailyUsage === "number") setUsage(f.dailyUsage);
    }
    if (f.type === "error") {
      setBusy(false);
      if (f.code === 429) setUsage(config.dailyLimit);
    }
  }, []);

  useEffect(() => {
    const sock = openSocket(
      async () => {
        const u = await restoreSession();
        return (u ?? user).idToken;
      },
      {
        onFrame,
        onStatus: (s, d) => {
          setStatus(s);
          setStatusDetail(d ?? "");
          if (s === "closed") setBusy(false);
        },
      },
    );
    socketRef.current = sock;
    return () => sock.close();
  }, [onFrame, user]);

  const overLimit = usage >= config.dailyLimit;

  const send = (prompt: string) => {
    const ok = socketRef.current?.send({ action: "sendMessage", sessionId, prompt, code, language });
    if (!ok) {
      setMessages((m) => [
        ...m,
        { id: uid(), role: "assistant", text: "Sin conexión con el servidor. Intenta de nuevo.", error: true },
      ]);
      return;
    }
    setBusy(true);
    setMessages((m) => [
      ...m,
      { id: uid(), role: "user", text: prompt },
      { id: uid(), role: "assistant", text: "", streaming: true },
    ]);
  };

  const newSession = () => {
    setSessionId(uid());
    setMessages([]);
  };

  const changeLanguage = (id: string) => {
    const prevSample = LANGUAGES.find((l) => l.id === language)?.sample;
    setLanguage(id);
    // Only swap the starter snippet if the student hasn't edited it.
    if (code === prevSample || !code.trim()) setCode(LANGUAGES.find((l) => l.id === id)?.sample ?? "");
  };

  const pct = Math.min(100, (usage / config.dailyLimit) * 100);

  return (
    <div className="app">
      <header className="topbar">
        <strong className="brand">Student Code IDE</strong>
        <select value={language} onChange={(e) => changeLanguage(e.target.value)} aria-label="Lenguaje">
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <div className="usage" title="Consultas de hoy (claim custom:dailyUsage)">
          <span>
            {usage}/{config.dailyLimit} consultas hoy
          </span>
          <div className="bar">
            <div className={`fill${pct >= 90 ? " hot" : ""}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className={`status ${status}`} title={statusDetail}>
          {status === "open" ? "Conectado" : status === "connecting" ? "Conectando…" : "Desconectado"}
        </span>
        <button onClick={newSession}>Nueva sesión</button>
        <button onClick={onLogout} title={user.email}>
          Salir
        </button>
      </header>

      {status === "closed" && statusDetail && <div className="banner">{statusDetail}</div>}

      <main className="split">
        <section className="pane editor-pane">
          <div className="pane-title">
            <span>main.{extension(language)}</span>
            <button onClick={() => setCode("")}>Limpiar</button>
          </div>
          <div className="editor-host">
            <CodeEditor value={code} language={language} onChange={setCode} />
          </div>
        </section>
        <section className="pane chat-pane">
          <div className="pane-title">
            <span>Asistente</span>
            <span className="muted small">Sesión {sessionId.slice(0, 8)}</span>
          </div>
          <Chat
            messages={messages}
            busy={busy}
            disabled={overLimit || status !== "open"}
            disabledReason={
              overLimit ? "Alcanzaste el límite diario de consultas." : "Esperando conexión con el servidor…"
            }
            onSend={send}
            onApplyCode={setCode}
          />
        </section>
      </main>
    </div>
  );
}

function extension(lang: string) {
  return (
    { python: "py", javascript: "js", typescript: "ts", java: "java", cpp: "cpp", csharp: "cs", go: "go" } as Record<
      string,
      string
    >
  )[lang] ?? "txt";
}
