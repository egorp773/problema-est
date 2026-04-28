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
      .select("id,status,confirmations_count")
      .eq("id", params.id)
      .single();

    if (problemError) throw problemError;
    if (!PUBLIC_STATUSES.includes(problem.status)) {
      return NextResponse.json({ error: "Эту проблему нельзя подтвердить." }, { status: 403 });
    }

    const { error } = await supabase.from("confirmations").insert({
      problem_id: params.id,
      telegram_user_id: telegramUserId,
      anonymous_key: telegramUserId ? null : anonymousKey
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({
          alreadyConfirmed: true,
          message: "Вы уже подтвердили эту проблему.",
          confirmations_count: problem.confirmations_count
        });
      }
      throw error;
    }

    const { data: updated } = await supabase
      .from("problems")
      .select("confirmations_count")
      .eq("id", params.id)
      .single();

    return NextResponse.json({
      alreadyConfirmed: false,
      message: "Вы подтвердили проблему. Поделитесь ссылкой, чтобы её увидело больше людей.",
      confirmations_count: updated?.confirmations_count ?? problem.confirmations_count + 1
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось подтвердить проблему" },
      { status: 500 }
    );
  }
}
