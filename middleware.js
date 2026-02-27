import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // 🔥 مهم جدًا: تجاهل ملفات Next الداخلية
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

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

  // ✅ Public routes
  const publicRoutes = ["/", "/login"];
  const isPublic =
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/apply");

  if (isPublic) {
    return res;
  }

  // 🔒 Require login
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

  // 🔴 Admin only
  if (pathname.startsWith("/admin") &&
      !pathname.startsWith("/admin/candidates") &&
      !pathname.startsWith("/admin/analytics")) {

    if (role !== "admin") {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // 🔵 HR + Admin
  if (
    pathname.startsWith("/admin/candidates") ||
    pathname.startsWith("/admin/analytics")
  ) {
    if (!["admin", "hr"].includes(role)) {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return res;
}