import { getUser, unauthorized } from "@/lib/auth";
export async function GET() {
  const ctx = await getUser(); if (!ctx) return unauthorized();
  const { data, error } = await ctx.sb.from("conversations").select("id,title,created_at").order("created_at", { ascending: false });
  return error ? Response.json({ error: "Database error" }, { status: 500 }) : Response.json({ conversations: data });
}
