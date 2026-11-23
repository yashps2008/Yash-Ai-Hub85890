import { admin } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export async function GET() {
  const need = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "TOKEN_ENCRYPTION_KEY",
    "INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET", "INSTAGRAM_WEBHOOK_VERIFY_TOKEN", "CRON_SECRET", "ANTHROPIC_API_KEY", "AI_MODEL"];
  const missing = need.filter((k) => !process.env[k]);
  let database = "unconfigured";
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { error } = await admin().from("webhook_events").select("id", { head: true }).limit(1);
    database = error ? "error" : "ok";
  }
  return Response.json({ backend: "ok", database, missing_env: missing, ai_configured: !missing.includes("ANTHROPIC_API_KEY") && !missing.includes("AI_MODEL"), instagram_configured: !missing.some((k) => k.startsWith("INSTAGRAM")) });
}
