"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ t: "err" | "ok"; s: string } | null>(null); const [busy, setBusy] = useState(false);
  async function submit(mode: "in" | "up") {
    setBusy(true); setMsg(null);
    const sb = supabaseBrowser();
    const { error } = mode === "in" ? await sb.auth.signInWithPassword({ email, password }) : await sb.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setMsg({ t: "err", s: error.message });
    if (mode === "up") return setMsg({ t: "ok", s: "Account created. Check your email if confirmation is enabled, then sign in." });
    window.location.href = "/";
  }
  return (
    <main className="card">
      <h1>Yash AI Hub</h1>
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
      <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" minLength={8} /></label>
      {msg && <p className={msg.t}>{msg.s}</p>}
      <button disabled={busy || !email || password.length < 8} onClick={() => submit("in")}>Sign in</button>{" "}
      <button disabled={busy || !email || password.length < 8} onClick={() => submit("up")} style={{ background: "#26262f" }}>Sign up</button>
    </main>
  );
}
