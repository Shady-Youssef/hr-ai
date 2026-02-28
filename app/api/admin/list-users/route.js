import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

const VALID_ROLES = new Set(["candidate", "hr", "admin"]);

export async function GET(req) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("pageSize") || 10))
    );
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const roleFilter = (url.searchParams.get("role") || "all")
      .trim()
      .toLowerCase();

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, phone, role, created_at, updated_at");

    if (profilesError) throw profilesError;

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const authUsers = [];
    const perPage = 200;
    let authPage = 1;

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page: authPage,
        perPage,
      });

      if (error) throw error;

      const batch = data?.users || [];
      authUsers.push(...batch);

      if (batch.length < perPage) break;
      authPage += 1;
      if (authPage > 100) break;
    }

    const merged = authUsers.map((user) => {
      const profile = profileMap.get(user.id);
      return {
        id: user.id,
        email: user.email || "",
        created_at: user.created_at || profile?.created_at || null,
        updated_at: profile?.updated_at || user.updated_at || null,
        first_name: profile?.first_name || "",
        last_name: profile?.last_name || "",
        phone: profile?.phone || "",
        role: profile?.role || "candidate",
      };
    });

    const filtered = merged.filter((user) => {
      const roleMatches =
        roleFilter === "all" ||
        (VALID_ROLES.has(roleFilter) && user.role === roleFilter);

      if (!roleMatches) return false;
      if (!search) return true;

      const name = `${user.first_name} ${user.last_name}`.trim().toLowerCase();
      return (
        user.email.toLowerCase().includes(search) || name.includes(search)
      );
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return Response.json({
      items,
      page: safePage,
      pageSize,
      total,
      totalPages,
    });
  } catch (err) {
    return Response.json(
      { error: err?.message || "Failed to list users" },
      { status: 500 }
    );
  }
}
