"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CATEGORIES, type Problem } from "@problema-est/shared";
import { Plus, Search } from "lucide-react";
import { ProblemCard } from "@/components/ProblemCard";

export default function HomePage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadProblems() {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (city.trim()) params.set("city", city.trim());
    if (category) params.set("category", category);

    try {
      const response = await fetch(`/api/problems?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setProblems(data.problems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить ленту");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();
    void loadProblems();
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6">
      <section className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Проблема есть</p>
        <h1 className="mt-2 text-4xl font-bold leading-tight text-ink">Сделай проблему видимой</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          Сообщите о реальной городской, бытовой или социальной проблеме. После модерации её смогут подтвердить другие люди.
        </p>
        <Link
          href="/new"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-4 text-lg font-semibold text-white shadow-soft transition hover:bg-brandDark"
        >
          <Plus className="h-6 w-6" />
          Сообщить проблему
        </Link>
      </section>

      <section className="mb-5 rounded-lg border border-line bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            className="min-h-12 rounded-lg border border-line px-3 outline-none focus:border-brand"
            placeholder="Город"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
          <select
            className="min-h-12 rounded-lg border border-line px-3 outline-none focus:border-brand"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Все категории</option>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            onClick={loadProblems}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line px-4 font-semibold text-ink"
          >
            <Search className="h-5 w-5" />
            Найти
          </button>
        </div>
      </section>

      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-muted">Загрузка...</p> : null}
      {!loading && problems.length === 0 ? (
        <p className="rounded-lg border border-line bg-white p-5 text-muted">Опубликованных проблем пока нет.</p>
      ) : null}

      <section className="grid gap-4 pb-8">
        {problems.map((problem) => (
          <ProblemCard key={problem.id} problem={problem} />
        ))}
      </section>
    </main>
  );
}
