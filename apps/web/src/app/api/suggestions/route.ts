import { NextResponse } from "next/server";
import { PUBLIC_STATUSES } from "@problema-est/shared";
import { getLocalCitySuggestions, mergeSuggestions } from "@/lib/geo";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function cleanQuery(value: string | null) {
  return String(value || "").trim().slice(0, 80);
}

function unique(values: Array<string | null | undefined>, limit = 8) {
  return mergeSuggestions(values.map((value) => String(value || ""))).slice(0, limit);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = cleanQuery(searchParams.get("type"));
    const query = cleanQuery(searchParams.get("q"));
    const city = cleanQuery(searchParams.get("city"));

    if (!query && type !== "address") {
      return NextResponse.json({ suggestions: [] });
    }

    const supabase = getSupabaseAdmin();

    if (type === "city") {
      const local = getLocalCitySuggestions(query, 8);
      const { data, error } = await supabase
        .from("problems")
        .select("city")
        .in("status", [...PUBLIC_STATUSES])
        .ilike("city", `${query}%`)
        .limit(20);

      if (error) throw error;

      return NextResponse.json({
        suggestions: mergeSuggestions(local, unique((data ?? []).map((item) => item.city), 8)).slice(0, 8)
      });
    }

    if (type === "address") {
      if (!city || query.length < 2) return NextResponse.json({ suggestions: [] });

      const { data, error } = await supabase
        .from("problems")
        .select("address")
        .in("status", [...PUBLIC_STATUSES])
        .ilike("city", city)
        .ilike("address", `%${query}%`)
        .limit(20);

      if (error) throw error;

      return NextResponse.json({
        suggestions: unique((data ?? []).map((item) => item.address), 8)
      });
    }

    return NextResponse.json({ error: "Неизвестный тип подсказок." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить подсказки." },
      { status: 500 }
    );
  }
}
