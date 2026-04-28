import { NextResponse } from "next/server";
import { PUBLIC_STATUSES } from "@problema-est/shared";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function commentsTableMissing(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("comments"));
}

function subscriptionsTableMissing(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("subscriptions"));
}

function fallbackComment(row: {
  id: string;
  created_at: string;
  problem_id: string | null;
  details: unknown;
}) {
  const details =
    typeof row.details === "object" && row.details
      ? row.details as { body?: unknown; display_name?: unknown; avatar_url?: unknown }
      : {};

  return {
    id: row.id,
    created_at: row.created_at,
    problem_id: row.problem_id || "",
    body: String(details.body || ""),
    display_name: String(details.display_name || "Пользователь"),
    avatar_url: details.avatar_url ? String(details.avatar_url) : null
  };
}

async function loadComments(problemId: string) {
  const supabase = getSupabaseAdmin();
  const [commentsResult, fallbackResult] = await Promise.all([
    supabase
      .from("comments")
      .select("id,created_at,problem_id,body,display_name,avatar_url")
      .eq("problem_id", problemId)
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("admin_actions")
      .select("id,created_at,problem_id,details")
      .eq("problem_id", problemId)
      .eq("action", "comment")
      .order("created_at", { ascending: true })
      .limit(100)
  ]);

  if (commentsResult.error && !commentsTableMissing(commentsResult.error)) throw commentsResult.error;
  if (fallbackResult.error) throw fallbackResult.error;

  return [
    ...(!commentsResult.error ? (commentsResult.data ?? []) : []),
    ...(fallbackResult.data ?? []).map(fallbackComment)
  ].sort((first, second) => new Date(first.created_at).getTime() - new Date(second.created_at).getTime());
}

async function loadFollowCount(problemId: string) {
  const supabase = getSupabaseAdmin();
  const [subscriptionsResult, fallbackResult] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id")
      .eq("problem_id", problemId)
      .limit(1000),
    supabase
      .from("admin_actions")
      .select("id")
      .eq("problem_id", problemId)
      .eq("action", "subscription")
      .limit(1000)
  ]);

  if (subscriptionsResult.error && !subscriptionsTableMissing(subscriptionsResult.error)) throw subscriptionsResult.error;
  if (fallbackResult.error) throw fallbackResult.error;

  return (!subscriptionsResult.error ? (subscriptionsResult.data?.length ?? 0) : 0) + (fallbackResult.data?.length ?? 0);
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const includeComments = searchParams.get("include") === "comments";
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("problems")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) throw error;
    if (!PUBLIC_STATUSES.includes(data.status)) {
      return NextResponse.json({ error: "Проблема недоступна публично" }, { status: 404 });
    }

    if (!includeComments) {
      return NextResponse.json({ problem: data });
    }

    const [comments, followsCount] = await Promise.all([
      loadComments(params.id),
      loadFollowCount(params.id)
    ]);
    return NextResponse.json({
      problem: {
        ...data,
        comments_count: comments.length,
        comments_preview: comments.slice(-2),
        follows_count: followsCount
      },
      comments
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Проблема не найдена" },
      { status: 404 }
    );
  }
}
