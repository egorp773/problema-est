import { NextResponse } from "next/server";
import { PUBLIC_STATUSES } from "@problema-est/shared";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isSubscriptionsMissing(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("subscriptions"));
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const telegramUserId = body.telegram_user_id ? String(body.telegram_user_id) : null;
    const anonymousKey = body.anonymous_key ? String(body.anonymous_key) : null;

    if (!telegramUserId && !anonymousKey) {
      return NextResponse.json({ error: "Не удалось определить пользователя." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: problem, error: problemError } = await supabase
      .from("problems")
      .select("id,status")
      .eq("id", params.id)
      .single();

    if (problemError) throw problemError;
    if (!PUBLIC_STATUSES.includes(problem.status)) {
      return NextResponse.json({ error: "Эту проблему нельзя отслеживать." }, { status: 403 });
    }

    const { error } = await supabase.from("subscriptions").insert({
      problem_id: params.id,
      telegram_user_id: telegramUserId,
      anonymous_key: anonymousKey
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({
          alreadySubscribed: true,
          message: "Вы уже отслеживаете эту проблему."
        });
      }

      if (isSubscriptionsMissing(error)) {
        const identityFilter = anonymousKey
          ? { anonymous_key: anonymousKey }
          : { telegram_user_id: telegramUserId };
        const { data: existing, error: existingError } = await supabase
          .from("admin_actions")
          .select("id")
          .eq("problem_id", params.id)
          .eq("action", "subscription")
          .contains("details", identityFilter)
          .limit(1);

        if (existingError) throw existingError;
        if (existing && existing.length > 0) {
          return NextResponse.json({
            alreadySubscribed: true,
            message: "Вы уже отслеживаете эту проблему."
          });
        }

        const fallback = await supabase.from("admin_actions").insert({
          problem_id: params.id,
          action: "subscription",
          details: {
            telegram_user_id: telegramUserId,
            anonymous_key: anonymousKey
          }
        });

        if (fallback.error) throw fallback.error;

        return NextResponse.json({
          alreadySubscribed: false,
          message: "Проблема добавлена в отслеживаемые."
        });
      }
      throw error;
    }

    return NextResponse.json({
      alreadySubscribed: false,
      message: "Проблема добавлена в отслеживаемые."
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось добавить проблему в отслеживаемые." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const telegramUserId = body.telegram_user_id ? String(body.telegram_user_id) : null;
    const anonymousKey = body.anonymous_key ? String(body.anonymous_key) : null;

    if (!telegramUserId && !anonymousKey) {
      return NextResponse.json({ error: "Не удалось определить пользователя." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (anonymousKey) {
      const deleted = await supabase
        .from("subscriptions")
        .delete()
        .eq("problem_id", params.id)
        .eq("anonymous_key", anonymousKey);

      if (deleted.error && !isSubscriptionsMissing(deleted.error)) throw deleted.error;
    }

    if (telegramUserId) {
      const deleted = await supabase
        .from("subscriptions")
        .delete()
        .eq("problem_id", params.id)
        .eq("telegram_user_id", telegramUserId);

      if (deleted.error && !isSubscriptionsMissing(deleted.error)) throw deleted.error;
    }

    const fallbackFilters = [];
    if (anonymousKey) fallbackFilters.push({ anonymous_key: anonymousKey });
    if (telegramUserId) fallbackFilters.push({ telegram_user_id: telegramUserId });

    for (const filter of fallbackFilters) {
      const { error } = await supabase
        .from("admin_actions")
        .delete()
        .eq("problem_id", params.id)
        .eq("action", "subscription")
        .contains("details", filter);

      if (error) throw error;
    }

    return NextResponse.json({
      removed: true,
      message: "Слежение убрано."
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось убрать слежение." },
      { status: 500 }
    );
  }
}
