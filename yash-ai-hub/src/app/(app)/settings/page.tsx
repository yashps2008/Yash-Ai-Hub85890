import { supabaseServer } from "@/lib/supabase/server";
import DisconnectButton from "@/components/DisconnectButton";
export const dynamic = "force-dynamic";

export default async function Settings({ searchParams }: { searchParams: Promise<{ ig?: string; ig_error?: string }> }) {
  const sp = await searchParams;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: accts } = await sb.from("ig_accounts").select("id,username,status,token_expires_at,ig_user_id");
  const aiOk = !!(process.env.ANTHROPIC_API_KEY && process.env.AI_MODEL);
  const igCfg = !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
  return (
    <main className="page">
      <h1>Settings</h1>
      {sp.ig === "connected" && <p className="ok">Instagram account connected and verified.</p>}
      {sp.ig_error && <p className="err">Instagram connection failed: {sp.ig_error}</p>}
      <h2>Account</h2><div className="box"><p>Email: {user?.email}</p><p className="muted">Sign out with the Log out button in the navigation.</p></div>
      <h2>AI</h2>
      <div className="box"><p>Provider: Anthropic</p><p>Model: {process.env.AI_MODEL || <span className="err">not set</span>}</p>
        <p>Status: {aiOk ? <span className="ok">credentials present</span> : <span className="err">setup required — set ANTHROPIC_API_KEY and AI_MODEL in Vercel env vars</span>}</p>
        <p className="muted">Keys live only on the server; change them in your hosting environment variables.</p></div>
      <h2>Instagram</h2>
      <div className="box">
        {!igCfg && <p className="err">Setup required: set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET.</p>}
        {accts?.filter((a) => a.status !== "disconnected").map((a) => (
          <p key={a.id} className="row">@{a.username} — <span className={a.status === "connected" ? "ok" : "err"}>{a.status}</span>
            {a.token_expires_at && <span className="muted">token expires {new Date(a.token_expires_at).toLocaleDateString()}</span>}
            {a.status === "expired" && <a href="/api/instagram/connect">Reconnect</a>}
            <DisconnectButton id={a.id} /></p>
        ))}
        {!accts?.some((a) => a.status !== "disconnected") && <p className="muted">No account connected.</p>}
        <p><a href="/api/instagram/connect"><button disabled={!igCfg}>Connect Instagram</button></a></p>
        <p className="muted">Webhook URL for Meta: <code>{process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/instagram</code></p>
      </div>
    </main>
  );
}
