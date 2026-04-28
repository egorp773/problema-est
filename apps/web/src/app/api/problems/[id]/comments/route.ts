import { NextResponse } from "next/server";
import { PUBLIC_STATUSES } from "@problema-est/shared";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

async function ensurePublicProblem(problemId: string) {
  const supabase = getSupabaseAdmin();
  const { data: problem, error } = await supabase
    .from("problems")
    .select("id,status")
    .eq("id", problemId)
    .single();

  if (error) throw error;
  return PUBLIC_STATUSES.includes(problem.status);
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const isPublic = await ensurePublicProblem(params.id);
    if (!isPublic) {
      return NextResponse.json({ error: "Комментарии доступны только у опубликованных проблем." }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("comments")
      .select("id,created_at,problem_id,body,display_name,avatar_url")
      .eq("problem_id", params.id)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) throw error;

    return NextResponse.json(
      { comments: data ?? [] },
      {
        headers: {
          "cache-control": "no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить комментарии." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const text = cleanText(body.body, 1000);
    const displayName = cleanText(body.display_name, 80) || "Пользователь";
    const avatarUrl = cleanText(body.avatar_url, 500) || null;
    const telegramUserId = body.telegram_user_id ? String(body.telegram_user_id) : null;
    const anonymousKey = body.anonymous_key ? String(body.anonymous_key) : null;

    if (!telegramUserId && !anonymousKey) {
      return NextResponse.json({ error: "Не удалось определить пользователя." }, { status: 400 });
    }

    if (text.length < 2) {
      return NextResponse.json({ error: "Напишите комментарий чуть подробнее." }, { status: 400 });
    }

    const isPublic = await ensurePublicProblem(params.id);
    if (!isPublic) {
      return NextResponse.json({ error: "Комментарии доступны только у опубликованных проблем." }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("comments")
      .insert({
        problem_id: params.id,
        body: text,
        display_name: displayName,
        avatar_url: avatarUrl,
        telegram_user_id: telegramUserId,
        anonymous_key: telegramUserId ? null : anonymousKey
      })
      .select("id,created_at,problem_id,body,display_name,avatar_url")
      .single();

    if (error) throw error;

    return NextResponse.json({ comment: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось сохранить комментарий." },
      { status: 500 }
    );
  }
}
