
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  const configId = process.env.INSTAGRAM_CONFIG_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appId || !configId || !appUrl) {
    return NextResponse.json(
      { error: "Instagram Unified Login is not fully configured" },
      { status: 503 }
    );
  }

  const state = randomBytes(24).toString("hex");
  const redirectUri = `${appUrl}/api/instagram/callback`;

  const url = new URL("https://www.facebook.com/dialog/oauth");

  url.search = new URLSearchParams({
    client_id: appId,
    config_id: configId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    display: "popup",
    prompt: "login",
  }).toString();

  const res = NextResponse.redirect(url);

  res.cookies.set("ig_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/instagram",
  });

  return res;
}
