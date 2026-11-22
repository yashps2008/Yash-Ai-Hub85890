import { NextRequest, NextResponse, after } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { admin } from "@/lib/supabase/admin";
import { runPending } from "@/lib/process";

export const runtime = "nodejs";

// Meta verification handshake
export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text(); // raw body required for signature check
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const expected = "sha256=" + createHmac("sha256", process.env.INSTAGRAM_APP_SECRET!).update(raw).digest("hex");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return new NextResponse("Invalid signature", { status: 401 });

  let body: any;
  try { body = JSON.parse(raw); } catch { return new NextResponse("Bad JSON", { status: 400 }); }
  if (body?.object !== "instagram" || !Array.isArray(body.entry)) return new NextResponse("Ignored", { status: 200 });

  const rows: any[] = [];
  for (const entry of body.entry) {
    for (const ch of entry.changes ?? []) {
      const v = ch?.value;
      if (ch?.field !== "comments" || !v?.id) continue;
      rows.push({
        event_key: `comment:${v.id}`,
        ig_user_id: String(entry.id),
        payload: { comment_id: String(v.id), text: String(v.text ?? ""), from_id: String(v.from?.id ?? "") },
      });
    }
  }
  if (rows.length) {
    // ignoreDuplicates => Meta's redelivery is a no-op
    const { error } = await admin().from("webhook_events").upsert(rows, { onConflict: "event_key", ignoreDuplicates: true });
    if (error) return new NextResponse("DB error", { status: 500 }); // non-2xx makes Meta retry
    after(() => runPending(rows.length).catch(() => {}));
  }
  return new NextResponse("OK", { status: 200 });
}
