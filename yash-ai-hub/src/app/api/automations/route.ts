import { getUser, unauthorized } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { automationInput } from "@/lib/automation-schema";

export async function GET(req: Request) {
  const c = await getUser(); if (!c) return unauthorized();
  const u = new URL(req.url); const q = u.searchParams.get("q")?.slice(0, 100); const st = u.searchParams.get("status");
  let query = c.sb.from("automations").select("*").order("created_at", { ascending: false });
  if (st === "enabled" || st === "disabled") query = query.eq("enabled", st === "enabled");
  if (q) query = query.ilike("name", `%${q.replace(/[%,]/g, "")}%`);
  const { data, error } = await query;
  return error ? Response.json({ error: "Database error" }, { status: 500 }) : Response.json({ automations: data });
}

export async function POST(req: Request) {
  const c = await getUser(); if (!c) return unauthorized();
  const p = automationInput.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: "Invalid input", issues: p.error.flatten() }, { status: 400 });
  const { data: acct } = await c.sb.from("ig_accounts").select("id,status").eq("id", p.data.ig_account_id).maybeSingle();
  if (!acct) return Response.json({ error: "Instagram account not found" }, { status: 404 });
  if (p.data.enabled && acct.status !== "connected") return Response.json({ error: "Instagram account is not connected" }, { status: 409 });
  const { data, error } = await c.sb.from("automations").insert({ ...p.data, user_id: c.user.id }).select("*").single();
  if (error || !data) return Response.json({ error: "Database error" }, { status: 500 });
  await admin().from("activity_logs").insert({ user_id: c.user.id, type: "automation_created", status: "ok", automation_id: data.id, detail: data.name });
  return Response.json({ automation: data }, { status: 201 });
}
