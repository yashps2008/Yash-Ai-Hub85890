import { supabaseServer } from "./supabase/server";
// Returns the RLS-scoped client and verified user, or null.
export async function getUser() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user ? { sb, user } : null;
}
export const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });
