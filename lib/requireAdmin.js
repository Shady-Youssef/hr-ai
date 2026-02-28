import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function getSupabaseServerClient(cookieStore) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Route handlers can fail setting cookies in some edge contexts.
          }
        },
      },
    }
  );
}

export async function getCurrentUserAndRole() {
  const cookieStore = await cookies();
  const supabase = getSupabaseServerClient(cookieStore);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, role: null, supabase, userError: userError || null };
  }

  const { data: profileRole } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  let role = profileRole?.role || null;

  if (!role) {
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = roleData?.role || null;
  }

  return { user, role, supabase, userError: null };
}

export async function requireAdmin() {
  return requireRoles(["admin"]);
}

export async function requireRoles(allowedRoles) {
  const { user, role } = await getCurrentUserAndRole();

  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!allowedRoles.includes(role)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { response: null, user, role };
}

export async function requireHrOrAdmin() {
  return requireRoles(["admin", "hr"]);
}
