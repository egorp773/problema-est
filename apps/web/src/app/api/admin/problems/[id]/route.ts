import { NextResponse } from "next/server";
import { CATEGORIES, STATUSES } from "@problema-est/shared";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isAdmin(request: Request) {
  const password = process.env.ADMIN_PASSWORD;
  return Boolean(password) && request.headers.get("x-admin-password") === password;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const update: Record<string, unknown> = {};

    if (typeof body.title === "string") update.title = body.title.trim();
    if (typeof body.clean_description === "string") update.clean_description = body.clean_description.trim();
    if (typeof body.desired_result === "string") update.desired_result = body.desired_result.trim();
    if (typeof body.category === "string" && CATEGORIES.includes(body.category)) update.category = body.category;
    if (typeof body.status === "string" && STATUSES.includes(body.status)) update.status = body.status;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Нет изменений." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("problems")
      .update(update)
      .eq("id", params.id)
      .select("*")
      .single();

    if (error) throw error;

    await supabase.from("admin_actions").insert({
      problem_id: params.id,
      action: update.status ? `set_status_${update.status}` : "update_problem",
      details: update
    });

    return NextResponse.json({ problem: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось обновить проблему" },
      { status: 500 }
    );
  }
}
