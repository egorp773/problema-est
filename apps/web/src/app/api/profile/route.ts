import { NextResponse } from "next/server";
import { PUBLIC_STATUSES, type Problem } from "@problema-est/shared";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const problemSelect = [
  "id",
  "created_at",
  "updated_at",
  "city",
  "address",
  "category",
  "raw_description",
  "title",
  "clean_description",
  "desired_result",
  "photo_url",
  "photo_urls",
  "status",
  "risk_flags",
  "moderation_reason",
  "confirmations_count",
  "created_by_telegram_id"
].join(",");

type ProfileProblem = Pick<
  Problem,
  | "id"
  | "created_at"
  | "updated_at"
  | "city"
  | "address"
  | "category"
  | "raw_description"
  | "title"
  | "clean_description"
  | "desired_result"
  | "photo_url"
  | "photo_urls"
  | "status"
  | "risk_flags"
  | "moderation_reason"
  | "confirmations_count"
  | "created_by_telegram_id"
>;

function isMissingOptionalStorage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message)
        : "";

  return message.includes("created_by_anonymous_key") || message.includes("subscriptions");
}

function fallbackProblemId(row: { problem_id?: string | null }) {
  return row.problem_id || "";
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return Array.from(map.values());
}

async function loadCreatedProblems(telegramUserId: string | null, anonymousKey: string | null) {
  const supabase = getSupabaseAdmin();
  const requests = [];

  if (telegramUserId) {
    requests.push(
      supabase
        .from("problems")
        .select(problemSelect)
        .eq("created_by_telegram_id", telegramUserId)
        .order("created_at", { ascending: false })
        .limit(50)
    );
  }

  if (anonymousKey) {
    requests.push(
      supabase
        .from("problems")
        .select(problemSelect)
        .eq("created_by_anonymous_key", anonymousKey)
        .order("created_at", { ascending: false })
        .limit(50)
    );
  }

  const results = await Promise.allSettled(requests);
  const problems: ProfileProblem[] = [];

  for (const result of results) {
    if (result.status === "rejected") {
      if (isMissingOptionalStorage(result.reason)) continue;
      throw result.reason;
    }

    if (result.value.error) {
      if (isMissingOptionalStorage(result.value.error)) continue;
      throw result.value.error;
    }

    problems.push(...((result.value.data ?? []) as unknown as ProfileProblem[]));
  }

  return uniqueById(problems).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

async function loadProblemIdsFromTable(table: "confirmations" | "subscriptions", telegramUserId: string | null, anonymousKey: string | null) {
  const supabase = getSupabaseAdmin();
  const requests = [];

  if (telegramUserId) {
    requests.push(
      supabase
        .from(table)
        .select("problem_id,created_at")
        .eq("telegram_user_id", telegramUserId)
        .order("created_at", { ascending: false })
        .limit(100)
    );
  }

  if (anonymousKey) {
    requests.push(
      supabase
        .from(table)
        .select("problem_id,created_at")
        .eq("anonymous_key", anonymousKey)
        .order("created_at", { ascending: false })
        .limit(100)
    );
  }

  const results = await Promise.allSettled(requests);
  const ids: string[] = [];

  for (const result of results) {
    if (result.status === "rejected") {
      if (table === "subscriptions" || isMissingOptionalStorage(result.reason)) continue;
      throw result.reason;
    }

    if (result.value.error) {
      if (table === "subscriptions" || isMissingOptionalStorage(result.value.error)) continue;
      throw result.value.error;
    }

    ids.push(...(result.value.data ?? []).map((item) => item.problem_id).filter(Boolean));
  }

  const uniqueIds = Array.from(new Set(ids));

  if (table === "subscriptions" && uniqueIds.length === 0) {
    const fallbackFilters = [];
    if (anonymousKey) fallbackFilters.push({ anonymous_key: anonymousKey });
    if (telegramUserId) fallbackFilters.push({ telegram_user_id: telegramUserId });

    const fallbackResults = await Promise.allSettled(
      fallbackFilters.map((filter) =>
        supabase
          .from("admin_actions")
          .select("problem_id")
          .eq("action", "subscription")
          .contains("details", filter)
          .limit(100)
      )
    );

    for (const result of fallbackResults) {
      if (result.status === "rejected") continue;
      if (result.value.error) continue;
      ids.push(...(result.value.data ?? []).map(fallbackProblemId).filter(Boolean));
    }
  }

  return Array.from(new Set(ids));
}

async function loadPublicProblemsByIds(ids: string[]) {
  if (ids.length === 0) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("problems")
    .select(problemSelect)
    .in("id", ids)
    .in("status", [...PUBLIC_STATUSES])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ProfileProblem[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const telegramUserId = searchParams.get("telegram_user_id")?.trim() || null;
    const anonymousKey = searchParams.get("anonymous_key")?.trim() || null;

    if (!telegramUserId && !anonymousKey) {
      return NextResponse.json({ error: "Не удалось определить пользователя." }, { status: 400 });
    }

    const [createdProblems, confirmedIds, followedIds] = await Promise.all([
      loadCreatedProblems(telegramUserId, anonymousKey),
      loadProblemIdsFromTable("confirmations", telegramUserId, anonymousKey),
      loadProblemIdsFromTable("subscriptions", telegramUserId, anonymousKey)
    ]);

    const [confirmedProblems, followedProblems] = await Promise.all([
      loadPublicProblemsByIds(confirmedIds),
      loadPublicProblemsByIds(followedIds)
    ]);

    const resolvedCount = createdProblems.filter((problem) => problem.status === "resolved").length;

    return NextResponse.json(
      {
        stats: {
          created: createdProblems.length,
          confirmed: confirmedIds.length,
          followed: followedIds.length,
          resolved: resolvedCount
        },
        createdProblems,
        confirmedProblems,
        followedProblems
      },
      {
        headers: {
          "cache-control": "no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить профиль." },
      { status: 500 }
    );
  }
}
