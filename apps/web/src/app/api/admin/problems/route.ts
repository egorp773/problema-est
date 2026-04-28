import { NextResponse } from "next/server";
import { STATUSES } from "@problema-est/shared";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isAdmin(request: Request) {
  const password = process.env.ADMIN_PASSWORD;
  return Boolean(password) && request.headers.get("x-admin-password") === password;
}

export async function GET(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 401 });
  }

  try {
    const requestedStatus = new URL(request.url).searchParams.get("status") || "pending";
    const safeStatus = STATUSES.includes(requestedStatus as never) ? requestedStatus : "pending";
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("problems")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (requestedStatus !== "all") {
      query = query.eq("status", safeStatus);
    }

    const [{ data, error }, { data: statusRows, error: countsError }] = await Promise.all([
      query,
      supabase.from("problems").select("status").limit(1000)
    ]);

    if (error) throw error;
    if (countsError) throw countsError;

    const counts: Record<string, number> = Object.fromEntries(STATUSES.map((status) => [status, 0]));
    for (const row of statusRows ?? []) {
      if (typeof row.status === "string" && row.status in counts) {
        counts[row.status] += 1;
      }
    }

    return NextResponse.json({
      problems: data ?? [],
      counts,
      total: statusRows?.length ?? 0
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить админ-список" },
      { status: 500 }
    );
  }
}
