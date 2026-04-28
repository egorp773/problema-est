import { NextResponse } from "next/server";
import { PUBLIC_STATUSES } from "@problema-est/shared";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
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

    return NextResponse.json({ problem: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Проблема не найдена" },
      { status: 404 }
    );
  }
}
