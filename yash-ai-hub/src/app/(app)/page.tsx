import { supabaseServer } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const cnt = async (t: string, f?: (q: any) => any) => {
    let q: any = sb.from(t).select("id", { count: "exact", head: true }); if (f) q = f(q);
    const { count, error } = await q; return error ? null : count ?? 0;
  };
  const [accts, active, total, sent, failed] = await Promise.all([
    cnt("ig_accounts", (q) => q.eq("status", "connected")), cnt("automations", (q) => q.eq("enabled", true)), cnt("automations"),
    cnt("executions", (q) => q.eq("status", "sent")), cnt("executions", (q) => q.in("status", ["failed", "unknown"])),
  ]);
  const { data: logs } = await sb.from("activity_logs").select("id,type,status,detail,created_at").order("created_at", { ascending: false }).limit(8);
  const dbOk = accts !== null;
  const aiOk = !!(process.env.ANTHROPIC_API_KEY && process.env.AI_MODEL);
  const igCfg = !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET && process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN);
  const Stat = ({ l, v }: { l: string; v: any }) => <div className="box"><span className="muted">{l}</span><b>{v ?? "—"}</b></div>;
  return (
    <main className="page">
      <h1>Welcome, {user?.email}</h1>
      <div className="grid">
        <Stat l="Instagram accounts connected" v={accts} /><Stat l="Active automations" v={active} /><Stat l="Total automations" v={total} />
        <Stat l="DMs confirmed sent" v={sent} /><Stat l="Failed / unknown" v={failed} />
      </div>
      <h2>Status</h2>
      <div className="box">
        <p>Backend: <span className="ok">running</span></p>
        <p>Database: {dbOk ? <span className="ok">reachable</span> : <span className="err">error</span>}</p>
        <p>AI provider: {aiOk ? <span className="ok">configured</span> : <span className="err">setup required (ANTHROPIC_API_KEY, AI_MODEL)</span>}</p>
        <p>Instagram app credentials: {igCfg ? <span className="ok">configured</span> : <span className="err">setup required</span>}</p>
        <p>Instagram account: {accts === null ? <span className="err">status unavailable</span> : accts > 0 ? <span className="ok">connected</span> : <span className="muted">not connected — see Settings</span>}</p>
      </div>
      <h2>Recent activity</h2>
      {logs?.length ? <table><tbody>{logs.map((l) => <tr key={l.id}><td>{new Date(l.created_at).toLocaleString()}</td><td>{l.type}</td><td>{l.status}</td><td>{l.detail}</td></tr>)}</tbody></table>
        : <p className="muted">No activity yet. Events appear here once you connect Instagram or create automations.</p>}
    </main>
  );
}
