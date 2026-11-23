"use client";
import { useEffect, useRef, useState } from "react";
type Msg = { id?: string; role: "user" | "assistant"; content: string; created_at?: string };
type Conv = { id: string; title: string };

export default function Chat() {
  const [convs, setConvs] = useState<Conv[]>([]); const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]); const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const end = useRef<HTMLDivElement>(null);
  const loadConvs = async () => { const r = await fetch("/api/conversations"); if (r.ok) setConvs((await r.json()).conversations); };
  useEffect(() => { loadConvs(); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function open(id: string | null) {
    setActive(id); setErr(""); setMsgs([]);
    if (id) { const r = await fetch(`/api/conversations/${id}`); if (r.ok) setMsgs((await r.json()).messages); else setErr("Could not load conversation"); }
  }
  async function send() {
    const text = input.trim(); if (!text || busy) return;
    setInput(""); setBusy(true); setErr("");
    const now = new Date().toISOString();
    setMsgs((m) => [...m, { role: "user", content: text, created_at: now }, { role: "assistant", content: "", created_at: now }]);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversation_id: active ?? undefined, message: text }) });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({}));
        setErr(j.error === "setup_required" ? `Setup required: ${j.detail}` : j.error === "rate_limited" ? "The AI provider is rate-limiting requests. Try again shortly." : j.detail || j.error || "Request failed");
        setMsgs((m) => m.slice(0, -1)); return;
      }
      const cid = r.headers.get("X-Conversation-Id"); if (cid) setActive(cid);
      const reader = r.body.getReader(), dec = new TextDecoder();
      for (;;) { const { done, value } = await reader.read(); if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], content: c[c.length - 1].content + chunk }; return c; }); }
      loadConvs();
    } catch { setErr("Connection interrupted. The reply may be incomplete and was not saved."); }
    finally { setBusy(false); }
  }
  async function rename(c: Conv) { const t = prompt("Rename conversation", c.title)?.trim(); if (!t) return;
    const r = await fetch(`/api/conversations/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: t }) }); if (r.ok) loadConvs(); else setErr("Rename failed"); }
  async function del(c: Conv, clear = false) { if (!confirm(clear ? "Clear all messages?" : "Delete this conversation?")) return;
    const r = await fetch(`/api/conversations/${c.id}${clear ? "?clear=1" : ""}`, { method: "DELETE" });
    if (!r.ok) return setErr("Action failed"); if (clear) setMsgs([]); else { if (active === c.id) open(null); loadConvs(); } }

  return (
    <main className="page chat" style={{ maxWidth: "none" }}>
      <aside style={{ overflow: "auto" }}>
        <button onClick={() => open(null)} style={{ width: "100%", marginBottom: 8 }}>New chat</button>
        {!convs.length && <p className="muted">No conversations yet.</p>}
        {convs.map((c) => <div key={c.id} className="box" style={{ padding: 8, marginBottom: 6, borderColor: c.id === active ? "#7c5cff" : undefined }}>
          <div onClick={() => open(c.id)} style={{ cursor: "pointer" }}>{c.title}</div>
          <div className="row"><button className="ghost" aria-label="Rename" onClick={() => rename(c)}>Rename</button><button className="ghost" onClick={() => del(c, true)}>Clear</button><button className="danger" onClick={() => del(c)}>Delete</button></div></div>)}
      </aside>
      <section style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div className="msgs" style={{ flex: 1 }}>
          {!msgs.length && <p className="muted">Send a message to start. Replies come from the configured AI provider.</p>}
          {msgs.map((m, i) => <div key={i} className={`m ${m.role}`}>{m.content || (busy ? "…" : "")}
            <div className="muted" style={{ fontSize: 11 }}>{m.created_at && new Date(m.created_at).toLocaleTimeString()} {m.role === "assistant" && m.content && <a href="#" onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(m.content); }}>Copy</a>}</div></div>)}
          <div ref={end} />
        </div>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="row"><textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} maxLength={8000} placeholder="Message" aria-label="Message"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ flex: 1, padding: 10, background: "#14141a", color: "inherit", border: "1px solid #26262f", borderRadius: 10, font: "inherit" }} />
          <button disabled={busy || !input.trim()} onClick={send}>{busy ? "…" : "Send"}</button></div>
      </section>
    </main>
  );
}
