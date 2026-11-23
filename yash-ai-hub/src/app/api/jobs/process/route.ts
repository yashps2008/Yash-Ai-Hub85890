import { NextRequest, NextResponse } from "next/server";
import { runPending } from "@/lib/process";
import { refreshExpiringTokens } from "@/lib/refresh";
export const runtime = "nodejs";
// Recovery + maintenance job (Vercel Cron): retries pending/interrupted events and refreshes expiring tokens.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json({ processed: await runPending(25), tokens_refreshed: await refreshExpiringTokens() });
}
