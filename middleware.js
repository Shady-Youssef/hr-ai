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

  // 🔥 PUBLIC ROUTES (مهمة جدًا لمنع redirect loop)
  const publicRoutes = ["/", "/login"];

  const isPublicRoute =
    publicRoutes.includes(url.pathname) ||
    url.pathname.startsWith("/apply");

  if (isPublicRoute) {
    return res;
  }

  // 🔒 أي صفحة تانية محتاجة login
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
  if (url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/candidates") && !url.pathname.startsWith("/admin/analytics")) {
    if (role !== "admin") {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // 🔵 HR + Admin
  if (
    url.pathname.startsWith("/admin/candidates") ||
    url.pathname.startsWith("/admin/analytics")
  ) {
    if (!["admin", "hr"].includes(role)) {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return res;
}