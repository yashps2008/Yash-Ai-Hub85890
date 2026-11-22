"use client";
import { useCallback, useEffect, useState } from "react";
type Acct = { id: string; username: string; status: string };
type Auto = { id: string; name: string; ig_account_id: string; keyword: string; match_type: string; case_sensitive: boolean; message: string; enabled: boolean };
const blank = { name: "", keyword: "", match_type: "contains", case_sensitive: false, message: "", ig_account_id: "" };

export default function Automations({ accounts }: { accounts: Acct[] }) {
  const usable = accounts.filter((a) => a.status === "connected");
  const [list, setList] = useState<Auto[] | null>(null); const [q, setQ] = useState(""); const [st, setSt] = useState("");
  const [form, setForm] = useState({ ...blank, ig_account_id: usable[0]?.id ?? "" }); const [editing, setEditing] = useState<string | null>(null);
  const [err, setErr] = useState(""); const [note, setNote] = useState(""); const [detail, setDetail] = useState<{ id: string; ex: any[] } | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/automations?q=${encodeURIComponent(q)}&status=${st}`);
    if (r.ok) setList((await r.json()).automations); else setErr("Could not load automations");
  }, [q, st]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setErr(""); setNote("");
    const body: any = { ...form }; if (editing) delete body.ig_account_id;
    const r = await fetch(editing ? `/api/automations/${editing}` : "/api/automations", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || "Save failed");
    setNote(editing ? "Automation updated." : "Automation created (disabled until you enable it)."); setEditing(null); setForm({ ...blank, ig_account_id: usable[0]?.id ?? "" }); load();
  }
  async function toggle(a: Auto) {
    const r = await fetch(`/api/automations/${a.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: !a.enabled }) });
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error || "Toggle failed"); load();
  }
  async function del(a: Auto) { if (!confirm(`Delete "${a.name}"?`)) return; const r = await fetch(`/api/automations/${a.id}`, { method: "DELETE" }); if (!r.ok) setErr("Delete failed"); load(); }
  async function view(a: Auto) { const r = await fetch(`/api/automations/${a.id}`); if (r.ok) setDetail({ id: a.id, ex: (await r.json()).executions }); }
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.name.trim() && form.keyword.trim() && form.message.trim() && (editing || form.ig_account_id);

  return (
    <main className="page">
      <h1>Automations</h1>
      {!usable.length && <p className="err">Connect an Instagram account in Settings before creating automations.</p>}
      <div className="box">
        <h3>{editing ? "Edit automation" : "New comment-to-DM automation"}</h3>
        <input placeholder="Name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={100} aria-label="Name" />
        {!editing && <select value={form.ig_account_id} onChange={(e) => set("ig_account_id", e.target.value)} aria-label="Account" style={{ padding: 12, width: "100%", background: "#0a0a0c", color: "inherit" }}>
          {usable.map((a) => <option key={a.id} value={a.id}>@{a.username}</option>)}</select>}
        <input placeholder="Trigger keyword or phrase" value={form.keyword} onChange={(e) => set("keyword", e.target.value)} maxLength={200} aria-label="Keyword" />
        <div className="row"><select value={form.match_type} onChange={(e) => set("match_type", e.target.value)} aria-label="Match method" style={{ padding: 12, background: "#0a0a0c", color: "inherit" }}>
          <option value="contains">Contains</option><option value="exact">Exact match</option><option value="starts_with">Starts with</option></select>
          <label><input type="checkbox" style={{ width: "auto" }} checked={form.case_sensitive} onChange={(e) => set("case_sensitive", e.target.checked)} /> Case sensitive</label></div>
        <textarea placeholder="DM message" value={form.message} onChange={(e) => set("message", e.target.value)} maxLength={1000} rows={3} aria-label="Message"
          style={{ width: "100%", marginTop: 6, padding: 10, background: "#0a0a0c", color: "inherit", border: "1px solid #26262f", borderRadius: 10, font: "inherit" }} />
        {err && <p className="err" role="alert">{err}</p>}{note && <p className="ok">{note}</p>}
        <div className="row" style={{ marginTop: 8 }}><button disabled={!valid} onClick={save}>{editing ? "Save changes" : "Create"}</button>
          {editing && <button className="ghost" onClick={() => { setEditing(null); setForm({ ...blank, ig_account_id: usable[0]?.id ?? "" }); }}>Cancel</button>}</div>
      </div>
      <div className="row" style={{ margin: "16px 0" }}>
        <input placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} aria-label="Search" />
        <select value={st} onChange={(e) => setSt(e.target.value)} aria-label="Status filter" style={{ padding: 12, background: "#14141a", color: "inherit" }}><option value="">All</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></div>
      {list === null && <p className="muted">Loading…</p>}
      {list?.length === 0 && <p className="muted">No automations found.</p>}
      {list?.map((a) => <div key={a.id} className="box" style={{ marginBottom: 8 }}>
        <div className="row"><strong>{a.name}</strong><span className={a.enabled ? "ok" : "muted"}>{a.enabled ? "Enabled" : "Disabled"}</span></div>
        <p className="muted">{a.match_type} “{a.keyword}”{a.case_sensitive ? " (case-sensitive)" : ""}</p><p>{a.message}</p>
        <div className="row"><button onClick={() => toggle(a)}>{a.enabled ? "Disable" : "Enable"}</button>
          <button className="ghost" onClick={() => { setEditing(a.id); setForm({ ...a }); window.scrollTo(0, 0); }}>Edit</button>
          <button className="ghost" onClick={() => view(a)}>History</button><button className="danger" onClick={() => del(a)}>Delete</button></div>
        {detail?.id === a.id && (detail.ex.length ? <table><tbody>{detail.ex.map((e) => <tr key={e.id}><td>{new Date(e.created_at).toLocaleString()}</td><td>{e.status}</td><td>{e.error}</td></tr>)}</tbody></table> : <p className="muted">No executions yet.</p>)}
      </div>)}
    </main>
  );
}
