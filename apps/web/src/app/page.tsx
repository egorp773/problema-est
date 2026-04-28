"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CATEGORIES, type ProblemWithSocial } from "@problema-est/shared";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { ProblemCard } from "@/components/ProblemCard";

export default function HomePage() {
  const [problems, setProblems] = useState<ProblemWithSocial[]>([]);
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProblems = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (city.trim()) params.set("city", city.trim());
    if (category) params.set("category", category);

    try {
      const response = await fetch(`/api/problems?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setProblems(data.problems);
      window.sessionStorage.setItem("problema_est_feed_cache", JSON.stringify(data.problems));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить ленту");
    } finally {
      setLoading(false);
    }
  }, [category, city]);

  function updateConfirmed(id: string, confirmationsCount: number) {
    setProblems((items) =>
      items.map((item) => (item.id === id ? { ...item, confirmations_count: confirmationsCount } : item))
    );
  }

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();
    try {
      const cached = window.sessionStorage.getItem("problema_est_feed_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setProblems(parsed);
          setLoading(false);
        }
      }
    } catch {
      // Cache is optional; invalid cache should not block the feed.
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadProblems(problems.length === 0);
    }, city.trim() ? 250 : 0);

    return () => window.clearTimeout(timeout);
  }, [category, city, loadProblems, problems.length]);

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-[#f7f8fa] px-0 pb-28">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">Проблема есть</p>
            <h1 className="text-2xl font-bold leading-tight text-ink">Сделай проблему видимой</h1>
          </div>
          <Link
            href="/new"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-soft"
            aria-label="Сообщить проблему"
          >
            <Plus className="h-6 w-6" />
          </Link>
        </div>
      </header>

      <section className="border-b border-line bg-white px-4 py-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <SlidersHorizontal className="h-4 w-4" />
          Фильтры
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            className="min-h-11 rounded-full border border-line bg-slate-50 px-4 text-sm outline-none focus:border-brand"
            placeholder="Город"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
          <button
            onClick={() => loadProblems(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink"
            aria-label="Найти"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategory("")}
            className={`shrink-0 rounded-full border px-3 py-2 text-sm font-semibold ${
              !category ? "border-brand bg-teal-50 text-brand" : "border-line bg-white text-ink"
            }`}
          >
            Все
          </button>
          {CATEGORIES.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`shrink-0 rounded-full border px-3 py-2 text-sm font-semibold ${
                category === item ? "border-brand bg-teal-50 text-brand" : "border-line bg-white text-ink"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="px-4 py-4">
        <Link
          href="/new"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-base font-semibold text-white shadow-soft"
        >
          <Plus className="h-5 w-5" />
          Сообщить проблему
        </Link>
      </section>

      {error ? <p className="mx-4 mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading && problems.length === 0 ? <FeedSkeleton /> : null}
      {!loading && problems.length === 0 ? (
        <p className="mx-4 rounded-xl border border-line bg-white p-5 text-muted">Опубликованных проблем пока нет.</p>
      ) : null}

      <section className="grid gap-4 sm:px-3">
        {problems.map((problem) => (
          <ProblemCard key={problem.id} problem={problem} onConfirmed={updateConfirmed} />
        ))}
      </section>
    </main>
  );
}

function FeedSkeleton() {
  return (
    <section className="grid gap-4 sm:px-3">
      {[0, 1].map((item) => (
        <article key={item} className="overflow-hidden border-y border-line bg-white sm:rounded-xl sm:border">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-10 w-10 rounded-full bg-slate-100" />
            <div className="grid flex-1 gap-2">
              <div className="h-3 w-2/3 rounded bg-slate-100" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
          </div>
          <div className="aspect-square bg-slate-100" />
          <div className="grid gap-2 px-4 py-4">
            <div className="h-4 w-28 rounded bg-slate-100" />
            <div className="h-3 w-full rounded bg-slate-100" />
            <div className="h-3 w-2/3 rounded bg-slate-100" />
          </div>
        </article>
      ))}
    </section>
  );
}
