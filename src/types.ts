export interface User {
  sub: string;
  email: string;
  idToken: string;
  /** Claim `custom:dailyUsage` injected by the Pre-Token Generation trigger. */
  dailyUsage: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
  error?: boolean;
}

/** Client -> server (route key: `sendMessage`). */
export interface OutgoingMessage {
  action: "sendMessage";
  sessionId: string;
  prompt: string;
  code: string;
  language: string;
}

/** Server -> client frames pushed via postToConnection. */
export type IncomingFrame =
  | { type: "chunk"; text: string }
  | { type: "done"; dailyUsage?: number }
  | { type: "error"; code?: number; message: string };
