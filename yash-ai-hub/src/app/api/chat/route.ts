import { z } from "zod";
import { getUser, unauthorized } from "@/lib/auth";
export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({ conversation_id: z.string().uuid().optional(), message: z.string().trim().min(1).max(8000) });

export async function POST(req: Request) {
  const ctx = await getUser(); if (!ctx) return unauthorized();
  const { sb, user } = ctx;
  const key = process.env.ANTHROPIC_API_KEY, model = process.env.AI_MODEL;
  if (!key || !model) return Response.json({ error: "setup_required", detail: "Set ANTHROPIC_API_KEY and AI_MODEL on the server." }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  const { message } = parsed.data;

  let cid = parsed.data.conversation_id;
  if (cid) {
    const { data } = await sb.from("conversations").select("id").eq("id", cid).maybeSingle();
    if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  } else {
    const { data, error } = await sb.from("conversations").insert({ user_id: user.id, title: message.slice(0, 60) }).select("id").single();
    if (error || !data) return Response.json({ error: "Database error" }, { status: 500 });
    cid = data.id;
  }
  const { error: insErr } = await sb.from("messages").insert({ conversation_id: cid, user_id: user.id, role: "user", content: message });
  if (insErr) return Response.json({ error: "Database error" }, { status: 500 });

  const { data: hist } = await sb.from("messages").select("role,content").eq("conversation_id", cid).order("created_at", { ascending: false }).limit(30);
  const messages = (hist ?? []).reverse();

  const up = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 2048, stream: true, messages }),
  }).catch(() => null);
  if (!up || !up.ok || !up.body) {
    const status = up?.status === 429 ? 429 : 502;
    return Response.json({ error: status === 429 ? "rate_limited" : "ai_provider_error", detail: up ? `Provider returned ${up.status}` : "Network error" }, { status });
  }

  const dec = new TextDecoder(), enc = new TextEncoder();
  let full = "", buf = "";
  const stream = new ReadableStream({
    async start(ctrl) {
      const reader = up.body!.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n"); buf = lines.pop() ?? "";
          for (const l of lines) {
            if (!l.startsWith("data: ")) continue;
            try {
              const j = JSON.parse(l.slice(6));
              if (j.type === "content_block_delta" && j.delta?.type === "text_delta") { full += j.delta.text; ctrl.enqueue(enc.encode(j.delta.text)); }
              if (j.type === "error") throw new Error(j.error?.message ?? "stream error");
            } catch (e) { if (e instanceof Error && e.message !== "Unexpected end of JSON input" && !(e instanceof SyntaxError)) throw e; }
          }
        }
        if (full) await sb.from("messages").insert({ conversation_id: cid, user_id: user.id, role: "assistant", content: full }); // saved only on success
        ctrl.close();
      } catch (e) { ctrl.error(e); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Conversation-Id": cid!, "Cache-Control": "no-store" } });
}
