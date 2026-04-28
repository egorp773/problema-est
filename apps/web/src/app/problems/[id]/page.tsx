"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Eye, MessageCircle, Send } from "lucide-react";
import { type Problem } from "@problema-est/shared";
import { appUrl, labelStatus } from "@/lib/format";
import { ensureAnonymousKey, getTelegramShareUrl, getTelegramUserId } from "@/lib/telegram";

function getPhotos(problem: Problem) {
  const photos = Array.isArray(problem.photo_urls) ? problem.photo_urls.filter(Boolean) : [];
  if (photos.length > 0) return photos.slice(0, 10);
  return problem.photo_url ? [problem.photo_url] : [];
}

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
      const response = await fetch(`/api/problems/${params.id}`, { cache: "no-store" });
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
      const telegramUserId = getTelegramUserId();
      const response = await fetch(`/api/problems/${params.id}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          telegram_user_id: telegramUserId,
          anonymous_key: telegramUserId ? null : ensureAnonymousKey()
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

  async function subscribe() {
    setMessage("");
    setError("");
    try {
      const telegramUserId = getTelegramUserId();
      const response = await fetch(`/api/problems/${params.id}/subscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          telegram_user_id: telegramUserId,
          anonymous_key: telegramUserId ? null : ensureAnonymousKey()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить проблему в отслеживаемые.");
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  if (loading) {
    return <main className="mx-auto max-w-xl px-4 py-6 text-muted">Загрузка...</main>;
  }

  if (!problem) {
    return (
      <main className="mx-auto max-w-xl px-4 py-6">
        <p className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>
      </main>
    );
  }

  const photos = getPhotos(problem);

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-[#f7f8fa] pb-28">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
        <Link href="/" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{problem.city}</p>
          <p className="truncate text-xs text-muted">{problem.address}</p>
        </div>
      </header>

      <article className="bg-white">
        {photos.length > 0 ? (
          <ProblemGallery photos={photos} title={problem.title} />
        ) : (
          <div className="flex aspect-square w-full flex-col justify-between bg-gradient-to-br from-teal-50 via-white to-slate-100 p-5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-brand">
              <span>{problem.category}</span>
              <span>{labelStatus(problem.status)}</span>
            </div>
            <h1 className="text-4xl font-bold leading-tight text-ink">{problem.title}</h1>
            <p className="text-base leading-7 text-slate-700">{problem.clean_description}</p>
          </div>
        )}

        <section className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={confirm} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                <CheckCircle2 className="h-7 w-7" />
                Меня касается
              </button>
              <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                <MessageCircle className="h-7 w-7" />
                Коммент.
              </button>
              <button onClick={subscribe} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Eye className="h-7 w-7" />
                Следить
              </button>
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

          <p className="mt-4 text-sm font-semibold text-ink">{problem.confirmations_count} подтверждений</p>
          <p className="mt-2 text-base leading-7 text-slate-800">{problem.clean_description}</p>

          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Нужный результат</h2>
            <p className="mt-2 leading-7 text-slate-800">{problem.desired_result}</p>
          </div>

          <div className="mt-4 rounded-xl border border-dashed border-line p-4">
            <p className="text-sm font-semibold text-ink">Комментарии</p>
            <p className="mt-1 text-sm text-muted">В MVP комментарии пока не сохраняются. Сейчас основной сигнал — подтверждения и репосты.</p>
          </div>

          {message ? <p className="mt-4 rounded-lg bg-teal-50 p-3 text-sm text-brand">{message}</p> : null}
          {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        </section>
      </article>
    </main>
  );
}

function ProblemGallery({ photos, title }: { photos: string[]; title: string }) {
  return (
    <section className="bg-slate-100">
      <div className="flex snap-x snap-mandatory overflow-x-auto">
        {photos.map((photo, index) => (
          <a key={photo} href={photo} target="_blank" rel="noreferrer" className="relative block min-w-full snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt={`${title} ${index + 1}`} className="aspect-square w-full object-cover" />
            <span className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white">
              {index + 1}/{photos.length}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
