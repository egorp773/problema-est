import { NextResponse } from "next/server";
import { CATEGORIES, PUBLIC_STATUSES } from "@problema-est/shared";
import { moderateProblem } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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

    return NextResponse.json({ problems: data ?? [] });
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
    const photoUrl = String(body.photo_url || "").trim() || null;
    const desired = String(body.desired_result || "").trim();
    const telegramId = body.created_by_telegram_id ? String(body.created_by_telegram_id) : null;

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
    const { data, error } = await supabase
      .from("problems")
      .insert({
        city,
        address,
        category: ai.category,
        raw_description: rawDescription,
        title: ai.title,
        clean_description: ai.clean_description,
        desired_result: ai.desired_result,
        photo_url: photoUrl,
        status: "pending",
        risk_flags: ai.risk_flags,
        moderation_reason: ai.moderation_reason,
        created_by_telegram_id: telegramId
      })
      .select("id,status")
      .single();

    if (error) throw error;

    return NextResponse.json({ problem: data, ai });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось отправить проблему" },
      { status: 500 }
    );
  }
}
