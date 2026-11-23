import { z } from "zod";
import { getUser, unauthorized } from "@/lib/auth";
type Ctx = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();

export async function GET(_: Request, { params }: Ctx) {
  const c = await getUser(); if (!c) return unauthorized();
  const { id } = await params; if (!uuid.safeParse(id).success) return Response.json({ error: "Invalid id" }, { status: 400 });
  const { data } = await c.sb.from("messages").select("id,role,content,created_at").eq("conversation_id", id).order("created_at");
  return Response.json({ messages: data ?? [] });
}
export async function PATCH(req: Request, { params }: Ctx) {
  const c = await getUser(); if (!c) return unauthorized();
  const { id } = await params;
  const p = z.object({ title: z.string().trim().min(1).max(100) }).safeParse(await req.json().catch(() => null));
  if (!uuid.safeParse(id).success || !p.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  const { data } = await c.sb.from("conversations").update({ title: p.data.title }).eq("id", id).select("id");
  return data?.length ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 });
}
// DELETE removes the conversation; ?clear=1 only removes its messages
export async function DELETE(req: Request, { params }: Ctx) {
  const c = await getUser(); if (!c) return unauthorized();
  const { id } = await params; if (!uuid.safeParse(id).success) return Response.json({ error: "Invalid id" }, { status: 400 });
  const clear = new URL(req.url).searchParams.get("clear") === "1";
  const q = clear ? c.sb.from("messages").delete().eq("conversation_id", id) : c.sb.from("conversations").delete().eq("id", id);
  const { error } = await q;
  return error ? Response.json({ error: "Database error" }, { status: 500 }) : Response.json({ ok: true });
}
