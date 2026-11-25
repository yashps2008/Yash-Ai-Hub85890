
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { admin } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";

const GRAPH = "https://graph.facebook.com/v27.0";

export async function GET(req: NextRequest) {
  const app = process.env.NEXT_PUBLIC_APP_URL!;

  const back = (e?: string) =>
    NextResponse.redirect(
      `${app}/settings${e ? `?ig_error=${encodeURIComponent(e)}` : "?ig=connected"}`
    );

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();

  if (!user) return NextResponse.redirect(`${app}/login`);

  const q = req.nextUrl.searchParams;
  const code = q.get("code");

  if (q.get("error") || !code) {
    return back(q.get("error_description") ?? "Authorization denied");
  }

  if (!q.get("state") || q.get("state") !== req.cookies.get("ig_state")?.value) {
    return back("Invalid state");
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;

  if (!appId || !appSecret) {
    return back("Instagram app credentials are not configured");
  }

  try {
    const tokenUrl = new URL(`${GRAPH}/oauth/access_token`);

    tokenUrl.search = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code: code.replace(/#_$/, ""),
    }).toString();

    const tokenRes = await fetch(tokenUrl, { cache: "no-store" });
    const tokenBody = await tokenRes.json();

    if (!tokenRes.ok || !tokenBody.access_token) {
      return back(tokenBody?.error?.message ?? "System-user token exchange failed");
    }

    const accountsUrl = new URL(`${GRAPH}/me/assigned_instagram_accounts`);
    accountsUrl.searchParams.set("fields", "id,username");

    const accountsRes = await fetch(accountsUrl, {
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`,
      },
      cache: "no-store",
    });

    const accountsBody = await accountsRes.json();

    if (!accountsRes.ok) {
      return back(accountsBody?.error?.message ?? "Could not retrieve assigned Instagram accounts");
    }

    const accounts = Array.isArray(accountsBody.data) ? accountsBody.data : [];

    if (accounts.length === 0) {
      return back("No Instagram professional account is assigned to this configuration");
    }

    const db = admin();

    for (const account of accounts) {
      if (!account.id || !account.username) continue;

      const { data: existing, error } = await db
        .from("ig_accounts")
        .select("id,user_id")
        .eq("ig_user_id", String(account.id))
        .maybeSingle();

      if (error) return back("Could not verify existing account ownership");

      if (existing && existing.user_id !== user.id) {
        return back("An Instagram account is already connected to another user");
      }
    }

    let saved = 0;

    for (const account of accounts) {
      if (!account.id || !account.username) continue;

      const { data: existing, error: lookupError } = await db
        .from("ig_accounts")
        .select("id")
        .eq("ig_user_id", String(account.id))
        .maybeSingle();

      if (lookupError) return back("Could not verify existing account");

      const accountData = {
        user_id: user.id,
        ig_user_id: String(account.id),
        username: account.username,
        token_enc: encrypt(tokenBody.access_token),
        token_expires_at: null,
        status: "connected",
      };

      const result = existing
        ? await db.from("ig_accounts").update(accountData).eq("id", existing.id)
        : await db.from("ig_accounts").insert(accountData);

      if (result.error) return back("Database error while saving Instagram account");

      saved++;
    }

    if (saved === 0) return back("No valid Instagram account was returned");

    await db.from("activity_logs").insert({
      user_id: user.id,
      type: "instagram_connected",
      status: "ok",
      detail: accounts.map((a: { username?: string }) => a.username).filter(Boolean).join(", "),
    });

    const res = back();
    res.cookies.delete("ig_state");
    return res;
  } catch {
    return back("Unexpected error during Instagram connection");
  }
}
