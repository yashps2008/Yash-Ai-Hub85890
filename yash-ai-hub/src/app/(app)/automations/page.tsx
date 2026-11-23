import { supabaseServer } from "@/lib/supabase/server";
import Automations from "@/components/Automations";
export const dynamic = "force-dynamic";
export default async function Page() {
  const sb = await supabaseServer();
  const { data } = await sb.from("ig_accounts").select("id,username,status");
  return <Automations accounts={data ?? []} />;
}
