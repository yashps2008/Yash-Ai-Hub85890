import { admin } from "./supabase/admin";
import { decrypt } from "./crypto";

const GRAPH = "https://graph.instagram.com/v23.0";

export function matches(text: string, kw: string, type: string, caseSensitive: boolean) {
  const t = caseSensitive ? text : text.toLowerCase();
  const k = caseSensitive ? kw : kw.toLowerCase();
  if (type === "exact") return t.trim() === k.trim();
  if (type === "starts_with") return t.trimStart().startsWith(k);
  return t.includes(k);
}

const log = (user_id: string, type: string, status: string, detail?: string, automation_id?: string) =>
  admin().from("activity_logs").insert({ user_id, type, status, detail, automation_id });

async function processEvent(ev: any) {
  const db = admin();
  const p = ev.payload as { comment_id: string; text: string; from_id: string };
  const { data: acct } = await db.from("ig_accounts").select("*").eq("ig_user_id", ev.ig_user_id).maybeSingle();
  if (!acct || acct.status !== "connected") return;
  if (p.from_id === acct.ig_user_id) return; // never reply to own comments
  if (acct.token_expires_at && new Date(acct.token_expires_at) < new Date()) {
    await db.from("ig_accounts").update({ status: "expired" }).eq("id", acct.id);
    await log(acct.user_id, "token_expired", "error", "Reconnect Instagram");
    return;
  }
  const { data: autos } = await db.from("automations").select("*").eq("ig_account_id", acct.id).eq("enabled", true).order("created_at", { ascending: true });
  for (const a of autos ?? []) {
    if (!matches(p.text ?? "", a.keyword, a.match_type, a.case_sensitive)) continue;
    // One comment may trigger at most one automation: first matching rule wins.
    await log(acct.user_id, "keyword_matched", "ok", `comment ${p.comment_id}`, a.id);
    // Unique(automation_id, comment_id): insert BEFORE sending so retries can never double-send
    const { data: ex, error } = await db.from("executions")
      .insert({ user_id: acct.user_id, automation_id: a.id, event_id: ev.id, comment_id: p.comment_id, status: "sending" })
      .select("id").single();
    // If this automation already has an execution record, stop here rather than
    // allowing a later matching automation to send a second reply for the comment.
    if (error || !ex) break;
    await log(acct.user_id, "dm_request_initiated", "info", undefined, a.id);
    try {
      const res = await fetch(`${GRAPH}/${acct.ig_user_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${decrypt(acct.token_enc)}`, "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { comment_id: p.comment_id }, message: { text: a.message } }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.message_id) {
        await db.from("executions").update({ status: "sent", api_response: body }).eq("id", ex.id);
        await log(acct.user_id, "dm_confirmed_sent", "ok", undefined, a.id);
      } else {
        const msg = body?.error?.message ?? `HTTP ${res.status}`;
        await db.from("executions").update({ status: "failed", api_response: body, error: msg }).eq("id", ex.id);
        await log(acct.user_id, "api_error", "error", msg, a.id);
      }
    } catch (e: any) {
      // Network error: the DM may or may not have been delivered. Do NOT retry blindly.
      await db.from("executions").update({ status: "unknown", error: String(e?.message ?? e) }).eq("id", ex.id);
      await log(acct.user_id, "dm_outcome_unknown", "error", String(e?.message ?? e), a.id);
    }
    // Do not evaluate another automation after the first keyword match.
    break;
  }
}

export async function runPending(limit = 10) {
  const db = admin();
  const stale = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: rows } = await db.from("webhook_events").select("id,attempts")
    .or(`status.eq.pending,and(status.eq.processing,locked_at.lt.${stale})`)
    .lt("attempts", 5).order("created_at").limit(limit);
  let done = 0;
  for (const r of rows ?? []) {
    // optimistic claim: succeeds for only one worker
    const { data: ev } = await db.from("webhook_events")
      .update({ status: "processing", locked_at: new Date().toISOString(), attempts: r.attempts + 1 })
      .eq("id", r.id).eq("attempts", r.attempts).select("*").maybeSingle();
    if (!ev) continue;
    try {
      await processEvent(ev);
      await db.from("webhook_events").update({ status: "done", error: null }).eq("id", ev.id);
      done++;
    } catch (e: any) {
      await db.from("webhook_events")
        .update({ status: ev.attempts >= 5 ? "failed" : "pending", error: String(e?.message ?? e) }).eq("id", ev.id);
    }
  }
  return done;
}
