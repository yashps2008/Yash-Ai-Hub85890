import { z } from "zod";
import { getUser, unauthorized } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const c = await getUser(); if (!c) return unauthorized();
  const p = z.object({ ig_account_id: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  const { data: acct } = await c.sb.from("ig_accounts").select("id,username").eq("id", p.data.ig_account_id).maybeSingle(); // RLS-scoped ownership check
  if (!acct) return Response.json({ error: "Not found" }, { status: 404 });
  const db = admin();
  await db.from("automations").update({ enabled: false }).eq("ig_account_id", acct.id);
  await db.from("ig_accounts").update({ status: "disconnected", token_enc: "" }).eq("id", acct.id); // token wiped
  await db.from("activity_logs").insert({ user_id: c.user.id, type: "instagram_disconnected", status: "ok", detail: acct.username });
  return Response.json({ ok: true });
}
