import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req) {
  const res = NextResponse.next();
  const url = req.nextUrl.clone();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (key) => req.cookies.get(key)?.value,
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 🔥 Public pages (no auth needed)
  if (
    url.pathname === "/" ||
    url.pathname.startsWith("/apply")
  ) {
    return res;
  }

  // 🔒 Everything else requires login
  if (!user) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = roleData?.role;

  // 🔴 Admin pages
  if (url.pathname.startsWith("/admin")) {
    if (role !== "admin") {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // 🔵 HR + Admin pages
  if (
    url.pathname.startsWith("/candidates") ||
    url.pathname.startsWith("/analytics")
  ) {
    if (!["admin", "hr"].includes(role)) {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return res;
}