import { FormEvent, useState } from "react";
import { confirmSignUp, signIn, signUp } from "../auth";
import { config } from "../config";
import type { User } from "../types";

type Mode = "signin" | "signup" | "confirm";

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signin") onLogin(await signIn(email, password));
      else if (mode === "signup") {
        await signUp(email, password);
        setMode("confirm");
      } else {
        await confirmSignUp(email, code);
        onLogin(await signIn(email, password));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login" onSubmit={submit}>
        <h1>Student Code IDE</h1>
        <p className="muted">
          {mode === "signin" && "Inicia sesión para usar el asistente."}
          {mode === "signup" && "Crea tu cuenta de estudiante."}
          {mode === "confirm" && "Ingresa el código enviado a tu correo."}
        </p>
        {config.mock && <p className="notice">Modo demo: cualquier credencial funciona.</p>}

        <label>
          Correo
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
        {mode !== "confirm" && (
          <label>
            Contraseña
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {mode === "confirm" && (
          <label>
            Código de verificación
            <input required value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" />
          </label>
        )}

        {error && <div className="error" role="alert">{error}</div>}

        <button className="primary" disabled={busy}>
          {busy ? "…" : mode === "signin" ? "Entrar" : mode === "signup" ? "Registrarme" : "Confirmar"}
        </button>

        {mode === "signin" && (
          <button type="button" className="link" onClick={() => setMode("signup")}>
            ¿No tienes cuenta? Regístrate
          </button>
        )}
        {mode !== "signin" && (
          <button type="button" className="link" onClick={() => setMode("signin")}>
            Volver a iniciar sesión
          </button>
        )}
      </form>
    </div>
  );
}
