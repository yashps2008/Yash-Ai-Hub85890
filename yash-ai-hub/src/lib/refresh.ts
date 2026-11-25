
import { admin } from "./supabase/admin";

// Unified Login uses a System User Access Token.
// It is not refreshed using the legacy Instagram Login refresh endpoint.
export async function refreshExpiringTokens() {
  const db = admin();

  const { data, error } = await db
    .from("ig_accounts")
    .select("id,user_id")
    .eq("status", "connected")
    .not("token_expires_at", "is", null);

  if (error) {
    throw new Error("Could not check Instagram token expiry");
  }

  let expired = 0;

  for (const account of data ?? []) {
    await db
      .from("ig_accounts")
      .update({ status: "expired" })
      .eq("id", account.id);

    await db.from("activity_logs").insert({
      user_id: account.user_id,
      type: "token_expired",
      status: "error",
      detail: "Reconnect Instagram using Unified Login",
    });

    expired++;
  }

  return expired;
}
