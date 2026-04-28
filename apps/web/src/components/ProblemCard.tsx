"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, MapPin, MessageCircle, MoreHorizontal, Send } from "lucide-react";
import { type Problem } from "@problema-est/shared";
import { appUrl, labelStatus } from "@/lib/format";
import { ensureAnonymousKey, getTelegramShareUrl, getTelegramUserId } from "@/lib/telegram";

export function ProblemCard({
  problem,
  onConfirmed
}: {
  problem: Problem;
  onConfirmed?: (id: string, confirmationsCount: number) => void;
}) {
  const [count, setCount] = useState(problem.confirmations_count);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setCount(problem.confirmations_count);
  }, [problem.confirmations_count]);

  const shareText = useMemo(() => {
    return `Проблема есть: ${problem.title}
Эту проблему уже подтвердили ${count} человек.
Подтверди, если тебя тоже касается: ${appUrl()}/problems/${problem.id}`;
  }, [count, problem.id, problem.title]);

  async function confirmProblem() {
    if (busy) return;
    setBusy(true);
    setNotice("");

    const previousCount = count;
    const optimisticCount = count + 1;
    setCount(optimisticCount);
    onConfirmed?.(problem.id, optimisticCount);

    try {
      const telegramUserId = getTelegramUserId();
      const response = await fetch(`/api/problems/${problem.id}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          telegram_user_id: telegramUserId,
          anonymous_key: telegramUserId ? null : ensureAnonymousKey()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setCount(data.confirmations_count);
      onConfirmed?.(problem.id, data.confirmations_count);
      setNotice(data.alreadyConfirmed ? "Вы уже подтверждали эту проблему." : "Вы подтвердили проблему.");
    } catch (error) {
      setCount(previousCount);
      onConfirmed?.(problem.id, previousCount);
      setNotice(error instanceof Error ? error.message : "Не удалось подтвердить проблему.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-xl border border-line bg-white shadow-soft">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{problem.city}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {problem.address}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-brand">
            {labelStatus(problem.status)}
          </span>
          <MoreHorizontal className="h-5 w-5 text-muted" />
        </div>
      </header>

      <Link href={`/problems/${problem.id}`} className="block bg-slate-100">
        {problem.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={problem.photo_url} alt="" className="aspect-square w-full object-cover" />
        ) : (
          <div className="flex aspect-square w-full flex-col justify-between bg-gradient-to-br from-teal-50 via-white to-slate-100 p-5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-brand">
              <span>{problem.category}</span>
              <span>{count} подтверждений</span>
            </div>
            <h3 className="text-3xl font-bold leading-tight text-ink">{problem.title}</h3>
            <p className="line-clamp-3 text-sm leading-6 text-slate-700">{problem.clean_description}</p>
          </div>
        )}
      </Link>

      <section className="px-4 py-3">
        {problem.photo_url ? (
          <div className="mb-3 border-b border-line pb-3">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-brand">
              <span>{problem.category}</span>
              <span>{count} подтверждений</span>
            </div>
            <h3 className="text-2xl font-bold leading-tight text-ink">{problem.title}</h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">{problem.clean_description}</p>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={confirmProblem}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink disabled:opacity-50"
            >
              <CheckCircle2 className={`h-6 w-6 ${count > problem.confirmations_count ? "text-brand" : ""}`} />
              Подтвердить
            </button>
            <Link href={`/problems/${problem.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
              <MessageCircle className="h-6 w-6" />
              Коммент.
            </Link>
          </div>
          <a
            href={getTelegramShareUrl(shareText)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-ink"
          >
            <Send className="h-4 w-4" />
            Поделиться
          </a>
        </div>

        <p className="mt-3 text-sm font-semibold text-ink">{count} подтверждений</p>
        {!problem.photo_url ? (
          <Link href={`/problems/${problem.id}`} className="mt-2 inline-block text-sm text-muted">
            Открыть детали и обсуждение
          </Link>
        ) : null}
        {notice ? <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">{notice}</p> : null}
      </section>
    </article>
  );
}
