import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { config } from "./config";
import type { User } from "./types";

let pool: CognitoUserPool | null = null;
function getPool() {
  if (!pool) pool = new CognitoUserPool({ UserPoolId: config.userPoolId, ClientId: config.clientId });
  return pool;
}

function decodeClaims(jwt: string): Record<string, unknown> {
  const b64 = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function toUser(session: CognitoUserSession): User {
  const idToken = session.getIdToken().getJwtToken();
  const c = decodeClaims(idToken);
  return {
    sub: String(c.sub),
    email: String(c.email ?? c["cognito:username"] ?? ""),
    idToken,
    dailyUsage: Number(c["custom:dailyUsage"] ?? 0),
  };
}

const MOCK_KEY = "mock-user";

/** Restores the session; the Cognito SDK refreshes expired tokens automatically. */
export function restoreSession(): Promise<User | null> {
  if (config.mock) {
    const raw = localStorage.getItem(MOCK_KEY);
    return Promise.resolve(raw ? (JSON.parse(raw) as User) : null);
  }
  return new Promise((resolve) => {
    const u = getPool().getCurrentUser();
    if (!u) return resolve(null);
    u.getSession((err: Error | null, s: CognitoUserSession | null) =>
      resolve(!err && s?.isValid() ? toUser(s) : null),
    );
  });
}

export function signIn(email: string, password: string): Promise<User> {
  if (config.mock) {
    const user: User = { sub: "mock-sub-1234", email, idToken: "mock", dailyUsage: 3 };
    localStorage.setItem(MOCK_KEY, JSON.stringify(user));
    return Promise.resolve(user);
  }
  const cu = new CognitoUser({ Username: email, Pool: getPool() });
  return new Promise((resolve, reject) =>
    cu.authenticateUser(new AuthenticationDetails({ Username: email, Password: password }), {
      onSuccess: (s) => resolve(toUser(s)),
      onFailure: reject,
      newPasswordRequired: () => reject(new Error("Se requiere cambiar la contraseña (flujo no implementado).")),
    }),
  );
}

export function signUp(email: string, password: string): Promise<void> {
  if (config.mock) return Promise.resolve();
  return new Promise((resolve, reject) =>
    getPool().signUp(email, password, [], [], (err) => (err ? reject(err) : resolve())),
  );
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  if (config.mock) return Promise.resolve();
  const cu = new CognitoUser({ Username: email, Pool: getPool() });
  return new Promise((resolve, reject) =>
    cu.confirmRegistration(code, true, (err) => (err ? reject(err) : resolve())),
  );
}

export function signOut() {
  if (config.mock) localStorage.removeItem(MOCK_KEY);
  else getPool().getCurrentUser()?.signOut();
}
