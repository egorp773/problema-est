"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Send } from "lucide-react";
import { type Problem } from "@problema-est/shared";
import { appUrl, labelStatus } from "@/lib/format";
import { ensureAnonymousKey, getTelegramShareUrl, getTelegramUserId } from "@/lib/telegram";

export default function ProblemPage({ params }: { params: { id: string } }) {
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const shareText = useMemo(() => {
    if (!problem) return "";
    return `Проблема есть: ${problem.title}
Эту проблему уже подтвердили ${problem.confirmations_count} человек.
Подтверди, если тебя тоже касается: ${appUrl()}/problems/${problem.id}`;
  }, [problem]);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/problems/${params.id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setProblem(data.problem);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Проблема не найдена");
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/problems/${params.id}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          telegram_user_id: getTelegramUserId(),
          anonymous_key: getTelegramUserId() ? null : ensureAnonymousKey()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(data.message);
      setProblem((current) => current ? { ...current, confirmations_count: data.confirmations_count } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось подтвердить проблему");
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  if (loading) {
    return <main className="mx-auto max-w-2xl px-4 py-6 text-muted">Загрузка...</main>;
  }

  if (!problem) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <p className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-6">
      <Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
        <ArrowLeft className="h-4 w-4" />
        Назад
      </Link>

      <article className="rounded-lg border border-line bg-white p-4 shadow-soft">
        <div className="mb-4">
          <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-brand">{labelStatus(problem.status)}</span>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-ink">{problem.title}</h1>
          <p className="mt-2 text-muted">{problem.city}, {problem.address}</p>
          <p className="mt-2 inline-block rounded-md bg-slate-100 px-2 py-1 text-sm">{problem.category}</p>
        </div>

        {problem.photo_url ? (
          <a href={problem.photo_url} target="_blank" rel="noreferrer" className="mb-4 block overflow-hidden rounded-lg border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={problem.photo_url} alt="" className="max-h-80 w-full object-cover" />
          </a>
        ) : null}

        <section className="grid gap-4 text-base leading-7 text-slate-800">
          <div>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Описание</h2>
            <p>{problem.clean_description}</p>
          </div>
          <div>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Нужный результат</h2>
            <p>{problem.desired_result}</p>
          </div>
        </section>

        <div className="mt-5 rounded-lg bg-slate-50 p-4 text-center">
          <p className="text-3xl font-bold text-ink">{problem.confirmations_count}</p>
          <p className="text-sm text-muted">подтверждений</p>
        </div>

        {message ? <p className="mt-4 rounded-lg bg-teal-50 p-3 text-sm text-brand">{message}</p> : null}
        {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-5 grid gap-3">
          <button onClick={confirm} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-lg font-semibold text-white">
            <CheckCircle2 className="h-6 w-6" />
            Меня тоже касается
          </button>
          <a href={getTelegramShareUrl(shareText)} target="_blank" rel="noreferrer" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg border border-line px-5 text-lg font-semibold text-ink">
            <Send className="h-5 w-5" />
            Поделиться
          </a>
        </div>
      </article>
    </main>
  );
}
