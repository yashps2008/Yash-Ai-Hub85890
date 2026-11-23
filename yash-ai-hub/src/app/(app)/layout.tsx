import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  async function logout() { "use server"; const s = await supabaseServer(); await s.auth.signOut(); redirect("/login"); }
  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <strong style={{ padding: 10 }}>Yash AI Hub</strong>
        <Link href="/">Dashboard</Link><Link href="/chat">AI Chat</Link><Link href="/automations">Automations</Link>
        <Link href="/logs">Activity</Link><Link href="/settings">Settings</Link>
        <form action={logout}><button>Log out</button></form>
      </nav>
      {children}
    </div>
  );
}
