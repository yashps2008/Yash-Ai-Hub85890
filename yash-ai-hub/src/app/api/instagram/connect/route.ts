import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.INSTAGRAM_APP_ID) return NextResponse.json({ error: "INSTAGRAM_APP_ID not configured" }, { status: 503 });
  const state = randomBytes(24).toString("hex");
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/instagram/callback`,
    response_type: "code",
    scope: "instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages",
    state,
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set("ig_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/api/instagram" });
  return res;
}
