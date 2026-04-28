import { NextResponse } from "next/server";
import { STATUSES } from "@problema-est/shared";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAdmin(request: Request) {
  const password = process.env.ADMIN_PASSWORD;
  return Boolean(password) && request.headers.get("x-admin-password") === password;
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      ...(init?.headers ?? {}),
    },
  });
}

function getSupabaseHost() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

export async function GET(request: Request) {
  if (!isAdmin(request)) {
    return noStoreJson({ error: "Доступ запрещён" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const requestedStatus = searchParams.get("status") || "pending";
    const requestedId = searchParams.get("id");

    if (requestedStatus !== "all" && !STATUSES.includes(requestedStatus as never)) {
      return noStoreJson(
        {
          error: "Неизвестный статус фильтра",
          requestedStatus,
          allowedStatuses: ["all", ...STATUSES],
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("problems")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(200);

    // Если передан id — ищем конкретную заявку и не применяем фильтр статуса.
    if (requestedId) {
      query = query.eq("id", requestedId);
    } else if (requestedStatus !== "all") {
      query = query.eq("status", requestedStatus);
    }

    const [listResult, statusResult, latestResult] = await Promise.all([
      query,
      supabase.from("problems").select("status", { count: "exact" }).limit(5000),
      supabase
        .from("problems")
        .select("id, created_at, status, title, city, address")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (listResult.error) throw listResult.error;
    if (statusResult.error) throw statusResult.error;
    if (latestResult.error) throw latestResult.error;

    const counts: Record<string, number> = Object.fromEntries(
      STATUSES.map((status) => [status, 0])
    );

    for (const row of statusResult.data ?? []) {
      if (typeof row.status === "string" && row.status in counts) {
        counts[row.status] += 1;
      }
    }

    return noStoreJson({
      problems: listResult.data ?? [],
      counts,
      total: statusResult.count ?? statusResult.data?.length ?? 0,
      debug: {
        requestedStatus,
        appliedStatus: requestedId ? null : requestedStatus,
        requestedId,
        returnedCount: listResult.data?.length ?? 0,
        totalCount: listResult.count,
        latestCreatedAt: latestResult.data?.[0]?.created_at ?? null,
        latestIds: (latestResult.data ?? []).map((item) => ({
          id: item.id,
          created_at: item.created_at,
          status: item.status,
          title: item.title,
          city: item.city,
          address: item.address,
        })),
        supabaseHost: getSupabaseHost(),
      },
    });
  } catch (error) {
    return noStoreJson(
      {
        error: error instanceof Error ? error.message : "Не удалось загрузить заявки",
        debug: {
          supabaseHost: getSupabaseHost(),
        },
      },
      { status: 500 }
    );
  }
}