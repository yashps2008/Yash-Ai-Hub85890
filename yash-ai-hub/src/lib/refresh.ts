import { admin } from "./supabase/admin";
import { decrypt, encrypt } from "./crypto";

// Long-lived Instagram tokens last ~60 days and can be refreshed once they are >24h old and not yet expired.
export async function refreshExpiringTokens() {
  const db = admin();
  const soon = new Date(Date.now() + 10 * 86400_000).toISOString();
  const { data } = await db.from("ig_accounts").select("id,user_id,token_enc,token_expires_at,created_at")
    .eq("status", "connected").lt("token_expires_at", soon);
  let refreshed = 0;
  for (const a of data ?? []) {
    try {
      const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${decrypt(a.token_enc)}`);
      const j = await r.json();
      if (r.ok && j.access_token) {
        await db.from("ig_accounts").update({ token_enc: encrypt(j.access_token), token_expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString() }).eq("id", a.id);
        refreshed++;
      } else {
        await db.from("activity_logs").insert({ user_id: a.user_id, type: "token_refresh_failed", status: "error", detail: j?.error?.message ?? `HTTP ${r.status}` });
      }
    } catch (e: any) {
      await db.from("activity_logs").insert({
        user_id: a.user_id,
        type: "token_refresh_failed",
        status: "error",
        detail: String(e?.message ?? "Token refresh request failed"),
      });
    }
  }
  return refreshed;
}
