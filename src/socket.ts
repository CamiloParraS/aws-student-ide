import { config } from "./config";
import type { IncomingFrame, OutgoingMessage } from "./types";

export type SocketStatus = "connecting" | "open" | "closed";

interface Handlers {
  onFrame: (f: IncomingFrame) => void;
  onStatus: (s: SocketStatus, detail?: string) => void;
}

export interface Socket {
  send: (m: OutgoingMessage) => boolean;
  close: () => void;
}

/**
 * Opens the API Gateway WebSocket. Browsers cannot set headers on a WebSocket,
 * so the Cognito ID token goes in the query string (`?token=`) and the Lambda
 * Authorizer on $connect reads it from `queryStringParameters`.
 */
export function openSocket(getToken: () => Promise<string>, h: Handlers): Socket {
  if (config.mock) return openMock(h);

  let ws: WebSocket | null = null;
  let closedByUser = false;
  let retry = 0;
  let timer: number | undefined;

  const connect = async () => {
    h.onStatus("connecting");
    const token = await getToken();
    if (closedByUser) return;
    const sock = new WebSocket(`${config.wsUrl}?token=${encodeURIComponent(token)}`);
    ws = sock;
    let opened = false;
    sock.onopen = () => {
      opened = true;
      retry = 0;
      h.onStatus("open");
    };
    sock.onmessage = (e) => {
      try {
        h.onFrame(JSON.parse(e.data) as IncomingFrame);
      } catch {
        /* ignore malformed frame */
      }
    };
    sock.onclose = () => {
      if (closedByUser) return;
      h.onStatus(
        "closed",
        opened
          ? "Conexión cerrada. Reintentando…"
          : "No se pudo conectar (sesión inválida o límite diario superado).",
      );
      timer = window.setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000));
    };
  };
  connect();

  return {
    send: (m) => {
      if (ws?.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify(m));
      return true;
    },
    close: () => {
      closedByUser = true;
      clearTimeout(timer);
      ws?.close();
    },
  };
}

/* ---------- Mock backend so the UI is usable before AWS exists ---------- */
function openMock(h: Handlers): Socket {
  let used = 3;
  const t = window.setTimeout(() => h.onStatus("open"), 300);
  h.onStatus("connecting");
  return {
    send: (m) => {
      const reply =
        `Revisé tu código en **${m.language}**.\n\n` +
        `### Observaciones\n- Usa nombres de variables más descriptivos.\n- Valida las entradas antes de procesarlas.\n\n` +
        `### Versión sugerida\n\`\`\`${m.language}\n${m.code.trim() || "// (editor vacío)"}\n\`\`\`\n\n` +
        `Pregunta recibida: _${m.prompt}_`;
      const parts = reply.match(/[\s\S]{1,6}/g) ?? [];
      let i = 0;
      const iv = window.setInterval(() => {
        if (i < parts.length) h.onFrame({ type: "chunk", text: parts[i++] });
        else {
          clearInterval(iv);
          h.onFrame({ type: "done", dailyUsage: ++used });
        }
      }, 25);
      return true;
    },
    close: () => clearTimeout(t),
  };
}
