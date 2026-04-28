"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Heart, MapPin, MessageCircle, MoreHorizontal, Send } from "lucide-react";
import { type Problem } from "@problema-est/shared";
import { appUrl, labelStatus } from "@/lib/format";
import {
  forgetConfirmedProblem,
  forgetFollowedProblem,
  isConfirmedLocally,
  isFollowedLocally,
  rememberConfirmedProblem,
  rememberFollowedProblem
} from "@/lib/local-actions";
import { getTelegramIdentity, getTelegramShareUrl } from "@/lib/telegram";

function getPhotos(problem: Problem) {
  const photos = Array.isArray(problem.photo_urls) ? problem.photo_urls.filter(Boolean) : [];
  if (photos.length > 0) return photos.slice(0, 10);
  return problem.photo_url ? [problem.photo_url] : [];
}

export function ProblemCard({
  problem,
  onConfirmed
}: {
  problem: Problem;
  onConfirmed?: (id: string, confirmationsCount: number) => void;
}) {
  const [count, setCount] = useState(problem.confirmations_count);
  const [busy, setBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [notice, setNotice] = useState("");
  const photos = getPhotos(problem);
  const hasPhotos = photos.length > 0;

  useEffect(() => {
    setCount(problem.confirmations_count);
    setConfirmed(isConfirmedLocally(problem.id));
    setFollowed(isFollowedLocally(problem.id));
  }, [problem.confirmations_count, problem.id]);

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
    const wasConfirmed = confirmed;
    const optimisticCount = wasConfirmed ? Math.max(count - 1, 0) : count + 1;
    setCount(optimisticCount);
    onConfirmed?.(problem.id, optimisticCount);
    setConfirmed(!wasConfirmed);
    if (wasConfirmed) forgetConfirmedProblem(problem.id);
    else rememberConfirmedProblem(problem.id);

    try {
      const identity = await getTelegramIdentity();
      const response = await fetch(`/api/problems/${problem.id}/confirm`, {
        method: wasConfirmed ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          telegram_user_id: identity.telegramUserId,
          anonymous_key: identity.anonymousKey
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setCount(data.confirmations_count);
      onConfirmed?.(problem.id, data.confirmations_count);
      setNotice("");
    } catch (error) {
      setCount(previousCount);
      onConfirmed?.(problem.id, previousCount);
      setConfirmed(wasConfirmed);
      if (wasConfirmed) rememberConfirmedProblem(problem.id);
      else forgetConfirmedProblem(problem.id);
      setNotice(error instanceof Error ? error.message : "Не удалось подтвердить проблему.");
    } finally {
      setBusy(false);
    }
  }

  async function followProblem() {
    if (followBusy) return;
    setFollowBusy(true);
    setNotice("");
    const wasFollowed = followed;
    setFollowed(!wasFollowed);
    if (wasFollowed) forgetFollowedProblem(problem.id);
    else rememberFollowedProblem(problem.id);

    try {
      const identity = await getTelegramIdentity();
      const response = await fetch(`/api/problems/${problem.id}/subscribe`, {
        method: wasFollowed ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          telegram_user_id: identity.telegramUserId,
          anonymous_key: identity.anonymousKey
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice("");
    } catch (error) {
      setFollowed(wasFollowed);
      if (wasFollowed) rememberFollowedProblem(problem.id);
      else forgetFollowedProblem(problem.id);
      setNotice(error instanceof Error ? error.message : "Не удалось добавить проблему в отслеживаемые.");
    } finally {
      setFollowBusy(false);
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

      {hasPhotos ? (
        <PhotoCarousel photos={photos} title={problem.title} problemId={problem.id} />
      ) : (
        <Link href={`/problems/${problem.id}`} className="block bg-slate-100">
          <div className="flex aspect-square w-full flex-col justify-between bg-gradient-to-br from-teal-50 via-white to-slate-100 p-5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-brand">
              <span>{problem.category}</span>
              <span>{count} подтверждений</span>
            </div>
            <h3 className="text-3xl font-bold leading-tight text-ink">{problem.title}</h3>
            <p className="line-clamp-3 text-sm leading-6 text-slate-700">{problem.clean_description}</p>
          </div>
        </Link>
      )}

      <section className="px-4 py-3">
        {hasPhotos ? (
          <div className="mb-3 border-b border-line pb-3">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-brand">
              <span>{problem.category}</span>
              <span>{count} подтверждений</span>
            </div>
            <h3 className="text-2xl font-bold leading-tight text-ink">{problem.title}</h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">{problem.clean_description}</p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              onClick={followProblem}
              disabled={followBusy}
              className={`inline-flex h-9 items-center gap-1 rounded-full px-3 text-[11px] font-semibold disabled:opacity-50 ${
                followed ? "bg-teal-50 text-brand" : "bg-slate-50 text-ink"
              }`}
              aria-label="Следить"
            >
              <Eye className={`h-4 w-4 ${followed ? "fill-brand/15 text-brand" : ""}`} />
              {followed ? "Слежу" : "Следить"}
            </button>
            <button
              onClick={confirmProblem}
              disabled={busy}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-ink disabled:opacity-50"
              aria-label="Поддержать"
            >
              <Heart className={`h-4 w-4 ${confirmed || count > problem.confirmations_count ? "fill-brand text-brand" : ""}`} />
            </button>
            <Link
              href={`/problems/${problem.id}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-ink"
              aria-label="Комментарии"
            >
              <MessageCircle className="h-4 w-4" />
            </Link>
          </div>
          <a
            href={getTelegramShareUrl(shareText)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-slate-100 px-3 text-[11px] font-semibold text-ink"
          >
            <Send className="h-3.5 w-3.5" />
            Поделиться
          </a>
        </div>

        <p className="mt-3 text-sm font-semibold text-ink">{count} подтверждений</p>
        {!hasPhotos ? (
          <Link href={`/problems/${problem.id}`} className="mt-2 inline-block text-sm text-muted">
            Открыть детали и обсуждение
          </Link>
        ) : null}
        {notice ? <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">{notice}</p> : null}
      </section>
    </article>
  );
}

function PhotoCarousel({ photos, title, problemId }: { photos: string[]; title: string; problemId: string }) {
  return (
    <section className="relative bg-slate-100">
      <div className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth">
        {photos.map((photo, index) => (
          <Link key={`${photo}-${index}`} href={`/problems/${problemId}`} className="relative block min-w-full snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt={`${title} ${index + 1}`} className="aspect-square w-full object-cover" loading="lazy" />
            {photos.length > 1 ? (
              <span className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white">
                {index + 1}/{photos.length}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
      {photos.length > 1 ? (
        <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
          {photos.map((photo, index) => (
            <span key={`${photo}-dot-${index}`} className="h-1.5 w-1.5 rounded-full bg-white/80 shadow" />
          ))}
        </div>
      ) : null}
    </section>
  );
}
