import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the session cookie and guards PAGES. API routes enforce auth themselves.
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user && req.nextUrl.pathname !== "/login") return NextResponse.redirect(new URL("/login", req.url));
  if (user && req.nextUrl.pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
  return res;
}
export const config = { matcher: ["/((?!api/|_next/|favicon.ico).*)"] };
