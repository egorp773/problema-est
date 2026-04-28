"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Heart, MessageCircle, Send } from "lucide-react";
import { type Problem, type ProblemComment } from "@problema-est/shared";
import { appUrl, labelStatus } from "@/lib/format";
import { isConfirmedLocally, isFollowedLocally, rememberConfirmedProblem, rememberFollowedProblem } from "@/lib/local-actions";
import { getTelegramDisplayName, getTelegramIdentity, getTelegramShareUrl } from "@/lib/telegram";

function getPhotos(problem: Problem) {
  const photos = Array.isArray(problem.photo_urls) ? problem.photo_urls.filter(Boolean) : [];
  if (photos.length > 0) return photos.slice(0, 10);
  return problem.photo_url ? [problem.photo_url] : [];
}

export default function ProblemPage({ params }: { params: { id: string } }) {
  const [problem, setProblem] = useState<Problem | null>(null);
  const [comments, setComments] = useState<ProblemComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [commentBusy, setCommentBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);

  const shareText = useMemo(() => {
    if (!problem) return "";
    return `Проблема есть: ${problem.title}
Эту проблему уже подтвердили ${problem.confirmations_count} человек.
Подтверди, если тебя тоже касается: ${appUrl()}/problems/${problem.id}`;
  }, [problem]);

  async function load() {
    setLoading(true);
    try {
      const [problemResponse, commentsResponse] = await Promise.all([
        fetch(`/api/problems/${params.id}`, { cache: "no-store" }),
        fetch(`/api/problems/${params.id}/comments`, { cache: "no-store" })
      ]);

      const data = await problemResponse.json();
      if (!problemResponse.ok) throw new Error(data.error);
      setProblem(data.problem);

      const commentsData = await commentsResponse.json();
      if (commentsResponse.ok) setComments(commentsData.comments ?? []);
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
      const identity = await getTelegramIdentity();
      const response = await fetch(`/api/problems/${params.id}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          telegram_user_id: identity.telegramUserId,
          anonymous_key: identity.anonymousKey
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(data.message);
      setProblem((current) => current ? { ...current, confirmations_count: data.confirmations_count } : current);
      setConfirmed(true);
      rememberConfirmedProblem(params.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось подтвердить проблему");
    }
  }

  async function subscribe() {
    setMessage("");
    setError("");
    try {
      const identity = await getTelegramIdentity();
      const response = await fetch(`/api/problems/${params.id}/subscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          telegram_user_id: identity.telegramUserId,
          anonymous_key: identity.anonymousKey
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(data.message);
      setSubscribed(true);
      rememberFollowedProblem(params.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить проблему в отслеживаемые.");
    }
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    setCommentBusy(true);

    try {
      const identity = await getTelegramIdentity();
      const response = await fetch(`/api/problems/${params.id}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: commentText,
          display_name: getTelegramDisplayName(identity.user),
          avatar_url: identity.user?.photo_url ?? null,
          telegram_user_id: identity.telegramUserId,
          anonymous_key: identity.anonymousKey
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setComments((current) => [...current, data.comment]);
      setCommentText("");
      setMessage("Комментарий опубликован.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить комментарий.");
    } finally {
      setCommentBusy(false);
    }
  }

  useEffect(() => {
    setConfirmed(isConfirmedLocally(params.id));
    setSubscribed(isFollowedLocally(params.id));
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <button
                onClick={subscribe}
                className={`inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[10px] font-semibold ${
                  subscribed ? "bg-teal-50 text-brand" : "bg-slate-50 text-ink"
                }`}
              >
                <Eye className={`h-4 w-4 ${subscribed ? "fill-brand/15 text-brand" : ""}`} />
                {subscribed ? "Слежу" : "Следить"}
              </button>
              <button
                onClick={confirm}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-ink"
                aria-label="Поддержать"
              >
                <Heart className={`h-4 w-4 ${confirmed ? "fill-brand text-brand" : ""}`} />
              </button>
              <button
                onClick={() => commentInputRef.current?.focus()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-ink"
                aria-label="Комментарии"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            </div>
            <a
              href={getTelegramShareUrl(shareText)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 text-[10px] font-semibold text-ink"
            >
              <Send className="h-3.5 w-3.5" />
              Поделиться
            </a>
          </div>

          <p className="mt-4 text-sm font-semibold text-ink">{problem.confirmations_count} подтверждений</p>
          <p className="mt-2 text-base leading-7 text-slate-800">{problem.clean_description}</p>

          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Нужный результат</h2>
            <p className="mt-2 leading-7 text-slate-800">{problem.desired_result}</p>
          </div>

          <section className="mt-4 rounded-xl border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink">Комментарии</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-muted">
                {comments.length}
              </span>
            </div>

            <form onSubmit={submitComment} className="mt-3 grid gap-2">
              <textarea
                ref={commentInputRef}
                rows={3}
                required
                minLength={2}
                maxLength={1000}
                className="rounded-xl border border-line px-3 py-3 text-sm leading-6 outline-none focus:border-brand"
                placeholder="Напишите комментарий"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
              />
              <button
                disabled={commentBusy || commentText.trim().length < 2}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {commentBusy ? "Отправляем..." : "Отправить комментарий"}
              </button>
              <p className="text-xs text-muted">Публично будут видны только имя, аватар и текст. Username и Telegram ID не показываются.</p>
            </form>

            <div className="mt-4 grid gap-3">
              {comments.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-3 text-sm text-muted">Комментариев пока нет.</p>
              ) : (
                comments.map((comment) => <CommentItem key={comment.id} comment={comment} />)
              )}
            </div>
          </section>

          {message ? <p className="mt-4 rounded-lg bg-teal-50 p-3 text-sm text-brand">{message}</p> : null}
          {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        </section>
      </article>
    </main>
  );
}

function CommentItem({ comment }: { comment: ProblemComment }) {
  return (
    <article className="flex gap-3 rounded-xl bg-slate-50 p-3">
      {comment.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={comment.avatar_url} alt={comment.display_name} className="h-10 w-10 rounded-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-brand">
          {comment.display_name.trim().slice(0, 1).toUpperCase() || "П"}
        </div>
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-ink">{comment.display_name || "Пользователь"}</p>
          <time className="text-xs text-muted" dateTime={comment.created_at}>
            {new Date(comment.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
          </time>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{comment.body}</p>
      </div>
    </article>
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
