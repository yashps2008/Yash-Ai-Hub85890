import { supabaseServer } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

export default async function Logs({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = "", status = "" } = await searchParams;
  const sb = await supabaseServer();
  let query = sb.from("activity_logs").select("id,type,status,detail,created_at,automations(name)").order("created_at", { ascending: false }).limit(200);
  const safe = q.replace(/[%,()]/g, "").slice(0, 60);
  if (safe) query = query.or(`type.ilike.%${safe}%,detail.ilike.%${safe}%`);
  if (status) query = query.eq("status", status.slice(0, 20));
  const { data, error } = await query;
  return (
    <main className="page">
      <h1>Activity &amp; execution log</h1>
      <form className="row" style={{ marginBottom: 12 }}>
        <input name="q" defaultValue={q} placeholder="Search events" style={{ maxWidth: 260 }} />
        <select name="status" defaultValue={status} style={{ padding: 12, background: "#14141a", color: "inherit", borderRadius: 10 }}>
          <option value="">All</option><option>ok</option><option>error</option><option>info</option>
        </select>
        <button>Filter</button>
      </form>
      {error && <p className="err">Could not load logs.</p>}
      {!error && !data?.length && <p className="muted">No matching events.</p>}
      {!!data?.length && <div style={{ overflowX: "auto" }}><table><thead><tr><th>Time</th><th>Event</th><th>Automation</th><th>Status</th><th>Detail</th></tr></thead>
        <tbody>{data.map((l: any) => <tr key={l.id}><td>{new Date(l.created_at).toLocaleString()}</td><td>{l.type}</td><td>{l.automations?.name ?? ""}</td><td className={l.status === "error" ? "err" : ""}>{l.status}</td><td>{l.detail}</td></tr>)}</tbody></table></div>}
    </main>
  );
}
