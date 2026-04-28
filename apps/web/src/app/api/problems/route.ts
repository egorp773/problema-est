import { NextResponse } from "next/server";
import { CATEGORIES, PUBLIC_STATUSES } from "@problema-est/shared";
import { moderateProblem } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PublicComment = {
  id: string;
  created_at: string;
  problem_id: string;
  body: string;
  display_name: string;
  avatar_url: string | null;
};

function fallbackComment(row: {
  id: string;
  created_at: string;
  problem_id: string | null;
  details: unknown;
}): PublicComment {
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

function commentsTableMissing(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("comments"));
}

function subscriptionsTableMissing(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("subscriptions"));
}

async function loadCommentMeta(problemIds: string[]) {
  if (problemIds.length === 0) {
    return {
      countByProblem: new Map<string, number>(),
      previewByProblem: new Map<string, PublicComment[]>()
    };
  }

  const supabase = getSupabaseAdmin();
  const [commentsResult, fallbackResult] = await Promise.all([
    supabase
      .from("comments")
      .select("id,created_at,problem_id,body,display_name,avatar_url")
      .in("problem_id", problemIds)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("admin_actions")
      .select("id,created_at,problem_id,details")
      .in("problem_id", problemIds)
      .eq("action", "comment")
      .order("created_at", { ascending: false })
      .limit(500)
  ]);

  if (commentsResult.error && !commentsTableMissing(commentsResult.error)) throw commentsResult.error;
  if (fallbackResult.error) throw fallbackResult.error;

  const comments: PublicComment[] = [
    ...(!commentsResult.error ? (commentsResult.data ?? []) : []),
    ...(fallbackResult.data ?? []).map(fallbackComment)
  ].sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime());

  const countByProblem = new Map<string, number>();
  const previewByProblem = new Map<string, PublicComment[]>();

  for (const comment of comments) {
    if (!comment.problem_id) continue;
    countByProblem.set(comment.problem_id, (countByProblem.get(comment.problem_id) ?? 0) + 1);
    const preview = previewByProblem.get(comment.problem_id) ?? [];
    if (preview.length < 2) {
      preview.push(comment);
      previewByProblem.set(comment.problem_id, preview);
    }
  }

  for (const [problemId, preview] of previewByProblem) {
    previewByProblem.set(problemId, [...preview].reverse());
  }

  return { countByProblem, previewByProblem };
}

async function loadFollowCounts(problemIds: string[]) {
  const countByProblem = new Map<string, number>();
  if (problemIds.length === 0) return countByProblem;

  const supabase = getSupabaseAdmin();
  const [subscriptionsResult, fallbackResult] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("problem_id")
      .in("problem_id", problemIds)
      .limit(1000),
    supabase
      .from("admin_actions")
      .select("problem_id")
      .in("problem_id", problemIds)
      .eq("action", "subscription")
      .limit(1000)
  ]);

  if (subscriptionsResult.error && !subscriptionsTableMissing(subscriptionsResult.error)) throw subscriptionsResult.error;
  if (fallbackResult.error) throw fallbackResult.error;

  const rows = [
    ...(!subscriptionsResult.error ? (subscriptionsResult.data ?? []) : []),
    ...(fallbackResult.data ?? [])
  ];

  for (const row of rows) {
    if (!row.problem_id) continue;
    countByProblem.set(row.problem_id, (countByProblem.get(row.problem_id) ?? 0) + 1);
  }

  return countByProblem;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city")?.trim();
    const category = searchParams.get("category")?.trim();
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("problems")
      .select("*")
      .in("status", [...PUBLIC_STATUSES])
      .order("created_at", { ascending: false })
      .limit(30);

    if (city) query = query.ilike("city", `%${city}%`);
    if (category) query = query.eq("category", category);

    const { data, error } = await query;
    if (error) throw error;

    const problems = data ?? [];
    const problemIds = problems.map((problem) => problem.id);
    const [{ countByProblem, previewByProblem }, followsByProblem] = await Promise.all([
      loadCommentMeta(problemIds),
      loadFollowCounts(problemIds)
    ]);

    return NextResponse.json({
      problems: problems.map((problem) => ({
        ...problem,
        comments_count: countByProblem.get(problem.id) ?? 0,
        comments_preview: previewByProblem.get(problem.id) ?? [],
        follows_count: followsByProblem.get(problem.id) ?? 0
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить проблемы" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const city = String(body.city || "").trim();
    const address = String(body.address || "").trim();
    const category = String(body.category || "").trim();
    const rawDescription = String(body.raw_description || "").trim();
    const photoUrls = Array.isArray(body.photo_urls)
      ? body.photo_urls.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 10)
      : [];
    const legacyPhotoUrl = String(body.photo_url || "").trim();
    const allPhotoUrls = [...photoUrls, ...(legacyPhotoUrl ? [legacyPhotoUrl] : [])].slice(0, 10);
    const photoUrl = allPhotoUrls[0] || null;
    const desired = String(body.desired_result || "").trim();
    const telegramId = body.created_by_telegram_id ? String(body.created_by_telegram_id) : null;
    const anonymousKey = body.created_by_anonymous_key ? String(body.created_by_anonymous_key) : null;

    if (!city || !address || !category || !rawDescription || !desired) {
      return NextResponse.json(
        { error: "Заполните город, адрес, категорию, описание и желаемый результат." },
        { status: 400 }
      );
    }
    if (!CATEGORIES.includes(category as never)) {
      return NextResponse.json({ error: "Неизвестная категория." }, { status: 400 });
    }

    const ai = await moderateProblem({
      rawText: rawDescription,
      category,
      city,
      address,
      desiredResult: desired
    });

    const supabase = getSupabaseAdmin();
    const payload = {
      city,
      address,
      category: ai.category,
      raw_description: rawDescription,
      title: ai.title,
      clean_description: ai.clean_description,
      desired_result: ai.desired_result,
      photo_url: photoUrl,
      photo_urls: allPhotoUrls,
      status: "pending",
      risk_flags: ai.risk_flags,
      moderation_reason: ai.moderation_reason,
      created_by_telegram_id: telegramId,
      created_by_anonymous_key: anonymousKey
    };

    let insertPayload = payload;
    let { data, error } = await supabase
      .from("problems")
      .insert(insertPayload)
      .select("id,status")
      .single();

    if (error) {
      if (error.message.includes("photo_urls") || error.message.includes("created_by_anonymous_key")) {
        const { photo_urls: _photoUrls, created_by_anonymous_key: _anonymousKey, ...legacyPayload } = payload;
        insertPayload = {
          ...legacyPayload,
          ...(error.message.includes("photo_urls") ? {} : { photo_urls: payload.photo_urls }),
          ...(error.message.includes("created_by_anonymous_key") ? {} : { created_by_anonymous_key: payload.created_by_anonymous_key })
        } as typeof payload;

        const legacyInsert = await supabase
          .from("problems")
          .insert(insertPayload)
          .select("id,status")
          .single();

        if (legacyInsert.error?.message.includes("photo_urls") || legacyInsert.error?.message.includes("created_by_anonymous_key")) {
          const { photo_urls: _photoUrls2, created_by_anonymous_key: _anonymousKey2, ...smallestPayload } = payload;
          const smallestInsert = await supabase
            .from("problems")
            .insert(smallestPayload)
            .select("id,status")
            .single();

          if (smallestInsert.error) throw smallestInsert.error;
          data = smallestInsert.data;
        } else if (legacyInsert.error) {
          throw legacyInsert.error;
        } else {
          data = legacyInsert.data;
        }

        return NextResponse.json({
          problem: data,
          ai,
          warning: "В Supabase ещё не применены новые колонки. Данные сохранены в совместимом режиме."
        });
      }
      throw error;
    }

    return NextResponse.json({ problem: data, ai });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось отправить проблему" },
      { status: 500 }
    );
  }
}
