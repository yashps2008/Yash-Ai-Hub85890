import { z } from "zod";
import { getUser, unauthorized } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { automationInput } from "@/lib/automation-schema";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const c = await getUser(); if (!c) return unauthorized();
  const { id } = await params; if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "Invalid id" }, { status: 400 });
  const { data } = await c.sb.from("automations").select("*").eq("id", id).maybeSingle();
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  const { data: executions } = await c.sb.from("executions").select("id,comment_id,status,error,created_at").eq("automation_id", id).order("created_at", { ascending: false }).limit(50);
  return Response.json({ automation: data, executions: executions ?? [] });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const c = await getUser(); if (!c) return unauthorized();
  const { id } = await params;
  const p = automationInput.omit({ ig_account_id: true }).partial().safeParse(await req.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !p.success || !Object.keys(p.data).length) return Response.json({ error: "Invalid input" }, { status: 400 });
  if (p.data.enabled) {
    const { data: a } = await c.sb.from("automations").select("ig_account_id").eq("id", id).maybeSingle();
    const { data: acct } = a ? await c.sb.from("ig_accounts").select("status").eq("id", a.ig_account_id).maybeSingle() : { data: null };
    if (acct?.status !== "connected") return Response.json({ error: "Instagram account is not connected" }, { status: 409 });
  }
  const { data } = await c.sb.from("automations").update({ ...p.data, updated_at: new Date().toISOString() }).eq("id", id).select("*").maybeSingle();
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  const type = p.data.enabled === true ? "automation_enabled" : p.data.enabled === false ? "automation_disabled" : "automation_modified";
  await admin().from("activity_logs").insert({ user_id: c.user.id, type, status: "ok", automation_id: id, detail: data.name });
  return Response.json({ automation: data });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const c = await getUser(); if (!c) return unauthorized();
  const { id } = await params; if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "Invalid id" }, { status: 400 });
  const { data } = await c.sb.from("automations").delete().eq("id", id).select("name");
  if (!data?.length) return Response.json({ error: "Not found" }, { status: 404 });
  await admin().from("activity_logs").insert({ user_id: c.user.id, type: "automation_deleted", status: "ok", detail: data[0].name });
  return Response.json({ ok: true });
}
