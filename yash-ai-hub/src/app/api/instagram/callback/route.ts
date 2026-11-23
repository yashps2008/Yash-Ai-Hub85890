import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { admin } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  const app = process.env.NEXT_PUBLIC_APP_URL!;
  const back = (e?: string) => NextResponse.redirect(`${app}/settings${e ? `?ig_error=${encodeURIComponent(e)}` : "?ig=connected"}`);
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(`${app}/login`);

  const q = req.nextUrl.searchParams;
  const code = q.get("code");
  if (q.get("error") || !code) return back(q.get("error_description") ?? "Authorization denied");
  if (!q.get("state") || q.get("state") !== req.cookies.get("ig_state")?.value) return back("Invalid state");

  try {
    const redirect_uri = `${app}/api/instagram/callback`;
    const short = await (await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_APP_ID!, client_secret: process.env.INSTAGRAM_APP_SECRET!,
        grant_type: "authorization_code", redirect_uri, code: code.replace(/#_$/, ""),
      }),
    })).json();
    if (!short.access_token) return back("Token exchange failed");

    const long = await (await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${short.access_token}`
    )).json();
    if (!long.access_token) return back("Long-lived token exchange failed");

    const me = await (await fetch(
      "https://graph.instagram.com/v23.0/me?fields=user_id,username,account_type",
      { headers: { Authorization: `Bearer ${long.access_token}` } }
    )).json();
    const igId = me.user_id ?? me.id;
    if (!igId) return back("Could not verify account");

    const db = admin();
    // Prevent an Instagram account already linked to another app user from being reassigned.
    const { data: existing, error: lookupError } = await db
      .from("ig_accounts")
      .select("id,user_id")
      .eq("ig_user_id", String(igId))
      .maybeSingle();
    if (lookupError) return back("Could not verify existing account ownership");
    if (existing && existing.user_id !== user.id) return back("This Instagram account is already connected to another user");

    const accountData = {
      user_id: user.id, ig_user_id: String(igId), username: me.username,
      token_enc: encrypt(long.access_token),
      token_expires_at: new Date(Date.now() + long.expires_in * 1000).toISOString(),
      status: "connected",
    };
    const { error } = existing
      ? await db.from("ig_accounts").update(accountData).eq("id", existing.id)
      : await db.from("ig_accounts").insert(accountData);
    if (error) return back("Database error");
    await db.from("activity_logs").insert({ user_id: user.id, type: "instagram_connected", status: "ok", detail: me.username });
    const res = back();
    res.cookies.delete("ig_state");
    return res;
  } catch {
    return back("Unexpected error");
  }
}
