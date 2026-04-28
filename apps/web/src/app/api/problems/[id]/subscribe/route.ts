import { NextResponse } from "next/server";
import { PUBLIC_STATUSES } from "@problema-est/shared";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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
      anonymous_key: telegramUserId ? null : anonymousKey
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({
          alreadySubscribed: true,
          message: "Вы уже отслеживаете эту проблему."
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
