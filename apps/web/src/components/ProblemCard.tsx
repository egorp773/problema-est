"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Eye, Heart, MapPin, MessageCircle, MoreHorizontal, Send, Trash2 } from "lucide-react";
import { type ProblemComment, type ProblemWithSocial } from "@problema-est/shared";
import { appUrl, labelStatus } from "@/lib/format";
import {
  forgetConfirmedProblem,
  forgetFollowedProblem,
  forgetOwnComment,
  isConfirmedLocally,
  isFollowedLocally,
  isOwnCommentLocally,
  rememberConfirmedProblem,
  rememberFollowedProblem,
  rememberOwnComment
} from "@/lib/local-actions";
import { getTelegramDisplayName, getTelegramIdentity, getTelegramShareUrl } from "@/lib/telegram";

function getPhotos(problem: ProblemWithSocial) {
  const photos = Array.isArray(problem.photo_urls) ? problem.photo_urls.filter(Boolean) : [];
  if (photos.length > 0) return photos.slice(0, 10);
  return problem.photo_url ? [problem.photo_url] : [];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

function tempId() {
  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ProblemCard({
  problem,
  onConfirmed
}: {
  problem: ProblemWithSocial;
  onConfirmed?: (id: string, confirmationsCount: number) => void;
}) {
  const [count, setCount] = useState(problem.confirmations_count);
  const [comments, setComments] = useState<ProblemComment[]>(problem.comments_preview ?? []);
  const [commentsCount, setCommentsCount] = useState(problem.comments_count ?? problem.comments_preview?.length ?? 0);
  const [followsCount, setFollowsCount] = useState(problem.follows_count ?? 0);
  const [commentText, setCommentText] = useState("");
  const [commentOpen, setCommentOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const photos = getPhotos(problem);
  const hasPhotos = photos.length > 0;

  useEffect(() => {
    setCount(problem.confirmations_count);
  }, [problem.confirmations_count]);

  useEffect(() => {
    setComments(problem.comments_preview ?? []);
    setCommentsCount(problem.comments_count ?? problem.comments_preview?.length ?? 0);
    setFollowsCount(problem.follows_count ?? 0);
    setConfirmed(isConfirmedLocally(problem.id));
    setFollowed(isFollowedLocally(problem.id));
  }, [problem.id, problem.comments_count, problem.comments_preview, problem.follows_count]);

  const shareText = useMemo(() => {
    return `Проблема есть: ${problem.title}
У этой проблемы уже ${count} лайков.
Поддержи или начни следить: ${appUrl()}/problems/${problem.id}`;
  }, [count, problem.id, problem.title]);

  async function toggleLike() {
    setError("");
    const wasConfirmed = confirmed;
    const previousCount = count;
    const optimisticCount = wasConfirmed ? Math.max(count - 1, 0) : count + 1;

    setConfirmed(!wasConfirmed);
    setCount(optimisticCount);
    onConfirmed?.(problem.id, optimisticCount);
    if (wasConfirmed) forgetConfirmedProblem(problem.id);
    else rememberConfirmedProblem(problem.id);

    try {
      const identity = await getTelegramIdentity(0);
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
    } catch (err) {
      setConfirmed(wasConfirmed);
      setCount(previousCount);
      onConfirmed?.(problem.id, previousCount);
      if (wasConfirmed) rememberConfirmedProblem(problem.id);
      else forgetConfirmedProblem(problem.id);
      setError(err instanceof Error ? err.message : "Не удалось обновить лайк.");
    }
  }

  async function toggleFollow() {
    setError("");
    const wasFollowed = followed;
    const previousCount = followsCount;
    setFollowed(!wasFollowed);
    setFollowsCount(wasFollowed ? Math.max(followsCount - 1, 0) : followsCount + 1);
    if (wasFollowed) forgetFollowedProblem(problem.id);
    else rememberFollowedProblem(problem.id);

    try {
      const identity = await getTelegramIdentity(0);
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
    } catch (err) {
      setFollowed(wasFollowed);
      setFollowsCount(previousCount);
      if (wasFollowed) rememberFollowedProblem(problem.id);
      else forgetFollowedProblem(problem.id);
      setError(err instanceof Error ? err.message : "Не удалось обновить слежение.");
    }
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    const text = commentText.trim();
    if (text.length < 2) return;

    setError("");
    setCommentText("");
    setCommentOpen(true);

    const identity = await getTelegramIdentity(0);
    const optimisticComment: ProblemComment = {
      id: tempId(),
      created_at: new Date().toISOString(),
      problem_id: problem.id,
      body: text,
      display_name: getTelegramDisplayName(identity.user),
      avatar_url: identity.user?.photo_url ?? null
    };

    setComments((current) => [...current, optimisticComment].slice(-3));
    setCommentsCount((current) => current + 1);

    try {
      const response = await fetch(`/api/problems/${problem.id}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: text,
          display_name: optimisticComment.display_name,
          avatar_url: optimisticComment.avatar_url,
          telegram_user_id: identity.telegramUserId,
          anonymous_key: identity.anonymousKey
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setComments((current) => current.map((comment) => (comment.id === optimisticComment.id ? data.comment : comment)));
      if (data.comment?.id) rememberOwnComment(String(data.comment.id));
    } catch (err) {
      setComments((current) => current.filter((comment) => comment.id !== optimisticComment.id));
      setCommentsCount((current) => Math.max(current - 1, 0));
      setCommentText(text);
      setError(err instanceof Error ? err.message : "Не удалось сохранить комментарий.");
    }
  }

  async function deleteComment(commentId: string) {
    const previousComments = comments;
    const previousCount = commentsCount;
    setComments((current) => current.filter((comment) => comment.id !== commentId));
    setCommentsCount((current) => Math.max(current - 1, 0));
    forgetOwnComment(commentId);

    try {
      const identity = await getTelegramIdentity(0);
      const response = await fetch(`/api/problems/${problem.id}/comments`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          comment_id: commentId,
          telegram_user_id: identity.telegramUserId,
          anonymous_key: identity.anonymousKey
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
    } catch (err) {
      setComments(previousComments);
      setCommentsCount(previousCount);
      rememberOwnComment(commentId);
      setError(err instanceof Error ? err.message : "Не удалось удалить комментарий.");
    }
  }

  function openCommentInput() {
    setCommentOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <article className="overflow-hidden border-y border-line bg-white sm:rounded-xl sm:border sm:shadow-soft">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <Link href={`/problems/${problem.id}`} className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-brand">
            {problem.city.trim().slice(0, 1).toUpperCase() || "П"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{problem.title}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {problem.city}{problem.address ? `, ${problem.address}` : ""}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-brand sm:inline-flex">
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
              <span>{labelStatus(problem.status)}</span>
            </div>
            <h3 className="text-3xl font-bold leading-tight text-ink">{problem.title}</h3>
            <p className="line-clamp-4 text-base leading-7 text-slate-700">{problem.clean_description}</p>
          </div>
        </Link>
      )}

      <section className="px-4 pb-4 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={toggleLike} className="inline-flex h-10 items-center gap-1.5 -ml-2 px-1 text-sm font-semibold text-ink" aria-label="Лайк">
              <Heart className={`h-7 w-7 transition ${confirmed ? "fill-red-500 text-red-500" : ""}`} />
              <span>{count}</span>
            </button>
            <button onClick={openCommentInput} className="inline-flex h-10 items-center gap-1.5 px-1 text-sm font-semibold text-ink" aria-label="Комментарии">
              <MessageCircle className="h-7 w-7" />
              <span>{commentsCount}</span>
            </button>
            <a
              href={getTelegramShareUrl(shareText)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center text-ink"
              aria-label="Поделиться"
            >
              <Send className="h-7 w-7" />
            </a>
          </div>
          <button
            onClick={toggleFollow}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
              followed ? "bg-teal-50 text-brand" : "bg-slate-50 text-ink"
            }`}
            aria-label="Следить"
          >
            <Eye className={`h-4 w-4 ${followed ? "fill-brand/15 text-brand" : ""}`} />
            <span>{followsCount}</span>
            <span>{followed ? "Слежу" : "Следить"}</span>
          </button>
        </div>

        <div className="mt-1 text-sm leading-6 text-slate-800">
          <span className="font-semibold text-ink">{problem.title}</span>{" "}
          <span className={descriptionOpen ? "" : "line-clamp-2"}>
            {problem.clean_description}
            {problem.desired_result ? ` Нужно: ${problem.desired_result}` : ""}
          </span>
          {!descriptionOpen ? (
            <button onClick={() => setDescriptionOpen(true)} className="ml-1 text-muted">
              ещё
            </button>
          ) : null}
        </div>

        {commentsCount > comments.length ? (
          <Link href={`/problems/${problem.id}`} className="mt-2 inline-block text-sm text-muted">
            Посмотреть все комментарии: {commentsCount}
          </Link>
        ) : null}

        {comments.length > 0 ? (
          <div className="mt-2 grid gap-1.5">
            {comments.map((comment) => (
              <InlineComment key={comment.id} comment={comment} onDelete={() => deleteComment(comment.id)} />
            ))}
          </div>
        ) : null}

        <form onSubmit={submitComment} className={`mt-3 ${commentOpen ? "flex" : "hidden"} items-center gap-2 border-t border-line pt-3`}>
          <input
            ref={inputRef}
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            minLength={2}
            maxLength={1000}
            className="min-w-0 flex-1 rounded-none border-0 bg-transparent text-sm outline-none"
            placeholder="Добавить комментарий..."
          />
          <button disabled={commentText.trim().length < 2} className="text-sm font-semibold text-brand disabled:text-muted">
            Опубликовать
          </button>
        </form>

        {!commentOpen ? (
          <button onClick={openCommentInput} className="mt-2 text-sm text-muted">
            Добавить комментарий...
          </button>
        ) : null}

        <time className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-muted" dateTime={problem.created_at}>
          {formatDate(problem.created_at)}
        </time>
        {error ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
      </section>
    </article>
  );
}

function InlineComment({ comment, onDelete }: { comment: ProblemComment; onDelete: () => void }) {
  return (
    <div className="flex items-start gap-2 text-sm leading-5 text-slate-800">
      {comment.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={comment.avatar_url} alt={comment.display_name} className="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover" loading="lazy" />
      ) : (
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[10px] font-bold text-brand">
          {comment.display_name.trim().slice(0, 1).toUpperCase() || "П"}
        </span>
      )}
      <p className="min-w-0 flex-1">
        <span className="font-semibold text-ink">{comment.display_name || "Пользователь"}</span>{" "}
        <span className="whitespace-pre-wrap">{comment.body}</span>
      </p>
      {isOwnCommentLocally(comment.id) ? (
        <button onClick={onDelete} className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center text-muted" aria-label="Удалить комментарий">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function PhotoCarousel({ photos, title, problemId }: { photos: string[]; title: string; problemId: string }) {
  const [index, setIndex] = useState(0);

  return (
    <section className="relative bg-black">
      <div
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
        onScroll={(event) => {
          const element = event.currentTarget;
          const nextIndex = Math.round(element.scrollLeft / Math.max(element.clientWidth, 1));
          setIndex(Math.min(Math.max(nextIndex, 0), photos.length - 1));
        }}
      >
        {photos.map((photo, photoIndex) => (
          <Link key={`${photo}-${photoIndex}`} href={`/problems/${problemId}`} className="relative block min-w-full snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt={`${title} ${photoIndex + 1}`} className="aspect-square w-full object-cover" loading={photoIndex === 0 ? "eager" : "lazy"} />
          </Link>
        ))}
      </div>
      {photos.length > 1 ? (
        <>
          <span className="absolute right-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold text-white">
            {index + 1}/{photos.length}
          </span>
          <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {photos.map((photo, dotIndex) => (
              <span
                key={`${photo}-dot-${dotIndex}`}
                className={`h-1.5 w-1.5 rounded-full shadow ${dotIndex === index ? "bg-brand" : "bg-white/80"}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
