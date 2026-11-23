"use client";
import { useState } from "react";
export default function DisconnectButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function go() {
    if (!confirm("Disconnect this account? All its automations will be disabled.")) return;
    setBusy(true);
    const r = await fetch("/api/instagram/disconnect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ig_account_id: id }) });
    if (r.ok) location.reload(); else { setErr("Failed to disconnect"); setBusy(false); }
  }
  return <span><button className="danger" disabled={busy} onClick={go}>{busy ? "Disconnecting…" : "Disconnect"}</button> <span className="err">{err}</span></span>;
}
