"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, STATUSES, type Problem, type ProblemStatus } from "@problema-est/shared";
import { Check, RefreshCw, Save, X } from "lucide-react";
import { labelStatus } from "@/lib/format";

const passwordKey = "problema_est_admin_password";
type AdminFilter = ProblemStatus | "all";
type Counts = Record<string, number>;

const filters: Array<{ value: AdminFilter; label: string }> = [
  { value: "pending", label: "На модерации" },
  { value: "published", label: "Опубликовано" },
  { value: "rejected", label: "Отклонено" },
  { value: "collecting_support", label: "Собирает поддержку" },
  { value: "sent_to_official_channel", label: "Отправлено" },
  { value: "resolved", label: "Решено" },
  { value: "all", label: "Все" }
];

function getPhotos(problem: Problem) {
  const photos = Array.isArray(problem.photo_urls) ? problem.photo_urls.filter(Boolean) : [];
  if (photos.length > 0) return photos.slice(0, 10);
  return problem.photo_url ? [problem.photo_url] : [];
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [filter, setFilter] = useState<AdminFilter>("pending");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [counts, setCounts] = useState<Counts>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string>("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const passwordRef = useRef("");
  const filterRef = useRef<AdminFilter>("pending");

  function getPassword() {
    return password.trim() || passwordRef.current || sessionStorage.getItem(passwordKey) || "";
  }

  async function load(nextFilter = filterRef.current, pass = getPassword(), silent = false) {
    if (!pass) {
      setError("Введите ADMIN_PASSWORD.");
      return;
    }

    if (!silent) setLoading(true);
    setError("");
    if (!silent) setMessage("");

    try {
      const response = await fetch(`/api/admin/problems?status=${nextFilter}&t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "x-admin-password": pass,
          "cache-control": "no-cache"
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить заявки.");

      passwordRef.current = pass;
      setPassword(pass);
      sessionStorage.setItem(passwordKey, pass);
      setProblems(data.problems ?? []);
      setCounts(data.counts ?? {});
      setTotal(data.total ?? 0);
      setLoggedIn(true);
      setLastLoadedAt(new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (err) {
      if (!silent) {
        setLoggedIn(false);
        setProblems([]);
        setError(err instanceof Error ? err.message : "Не удалось загрузить заявки.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function save(problem: Problem, patch: Partial<Problem>) {
    const pass = getPassword();
    if (!pass) {
      setError("Введите ADMIN_PASSWORD и нажмите «Войти / обновить».");
      return;
    }

    setSavingId(problem.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/problems/${problem.id}`, {
        method: "PATCH",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "x-admin-password": pass,
          "cache-control": "no-cache"
        },
        body: JSON.stringify(patch)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить изменения.");

      const updated = data.problem as Problem;
      setMessage(`Сохранено: ${labelStatus(updated.status)}.`);
      await load(filterRef.current, pass, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить изменения.");
    } finally {
      setSavingId(null);
    }
  }

  function changeFilter(nextFilter: AdminFilter) {
    filterRef.current = nextFilter;
    setFilter(nextFilter);
    if (loggedIn) void load(nextFilter);
  }

  useEffect(() => {
    const saved = sessionStorage.getItem(passwordKey);
    if (saved) void load("pending", saved);

    const interval = window.setInterval(() => {
      if (passwordRef.current) void load(filterRef.current, passwordRef.current, true);
    }, 5000);

    const onFocus = () => {
      if (passwordRef.current) void load(filterRef.current, passwordRef.current, true);
    };
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">Админка</h1>
          <p className="mt-2 text-muted">Ручная модерация проблем перед публикацией.</p>
        </div>
        {loggedIn ? (
          <div className="rounded-lg border border-line bg-white px-4 py-3 text-sm text-muted">
            Всего: <span className="font-semibold text-ink">{total}</span> · На модерации:{" "}
            <span className="font-semibold text-ink">{counts.pending ?? 0}</span>
            {lastLoadedAt ? <span> · Обновлено: {lastLoadedAt}</span> : null}
          </div>
        ) : null}
      </header>

      <section className="mt-5 grid gap-3 rounded-lg border border-line bg-white p-4 shadow-soft sm:grid-cols-[1fr_auto_auto]">
        <input
          type="password"
          className="min-h-12 rounded-lg border border-line px-3 outline-none focus:border-brand"
          placeholder="ADMIN_PASSWORD"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void load(filter);
          }}
        />
        <button
          onClick={() => void load(filter)}
          disabled={loading}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand px-5 font-semibold text-white disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Загрузка..." : "Войти / обновить"}
        </button>
        <a href="/" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-line px-5 font-semibold text-ink">
          Лента
        </a>
      </section>

      {loggedIn ? (
        <section className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => {
            const count = item.value === "all" ? total : counts[item.value] ?? 0;
            const active = filter === item.value;
            return (
              <button
                key={item.value}
                onClick={() => changeFilter(item.value)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold ${
                  active ? "border-brand bg-teal-50 text-brand" : "border-line bg-white text-ink"
                }`}
              >
                {item.label} <span className="text-muted">{count}</span>
              </button>
            );
          })}
        </section>
      ) : null}

      {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mt-4 rounded-lg bg-teal-50 p-3 text-sm text-brand">{message}</p> : null}

      {loggedIn && !loading && problems.length === 0 ? (
        <p className="mt-5 rounded-lg border border-line bg-white p-5 text-muted">
          В этом статусе заявок нет. Проверьте вкладку «Все» или поле status в Supabase.
        </p>
      ) : null}

      <section className="mt-5 grid gap-4 pb-8">
        {problems.map((problem) => (
          <AdminProblem key={problem.id} problem={problem} saving={savingId === problem.id} onSave={save} />
        ))}
      </section>
    </main>
  );
}

function AdminProblem({
  problem,
  saving,
  onSave
}: {
  problem: Problem;
  saving: boolean;
  onSave: (problem: Problem, patch: Partial<Problem>) => void;
}) {
  const [draft, setDraft] = useState(problem);
  const riskFlags = useMemo(() => (Array.isArray(problem.risk_flags) ? problem.risk_flags : []), [problem.risk_flags]);
  const photos = getPhotos(problem);

  useEffect(() => setDraft(problem), [problem]);

  function draftPatch(status: ProblemStatus = draft.status): Partial<Problem> {
    return {
      title: draft.title,
      clean_description: draft.clean_description,
      desired_result: draft.desired_result,
      category: draft.category,
      status
    };
  }

  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold leading-snug text-ink">{problem.title || "Без заголовка"}</h2>
          <p className="mt-1 text-sm text-muted">
            {problem.city || "Город не указан"}, {problem.address || "адрес не указан"} · {problem.category || "категория не указана"}
          </p>
          <p className="mt-1 text-xs text-muted">ID: {problem.id}</p>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-ink">
          {labelStatus(problem.status)}
        </span>
      </div>

      {photos.length > 0 ? <AdminPhotos photos={photos} title={problem.title} /> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="grid gap-3 text-sm">
          <InfoBlock title="Сырой текст пользователя" value={problem.raw_description || "Не указан"} />
          <InfoBlock title="AI-описание сейчас" value={problem.clean_description || "Не указано"} />
          <InfoBlock title="Желаемый результат сейчас" value={problem.desired_result || "Не указан"} />
          <div>
            <p className="font-semibold text-ink">Risk flags</p>
            <p className={`mt-1 rounded-lg p-3 ${riskFlags.length ? "bg-amber-50 text-warn" : "bg-teal-50 text-brand"}`}>
              {riskFlags.length ? riskFlags.join(", ") : "нет"}
            </p>
          </div>
          <InfoBlock title="Причина модерации" value={problem.moderation_reason || "Не указана"} />
        </section>

        <section className="grid gap-3">
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Заголовок
            <input
              className="min-h-11 rounded-lg border border-line px-3 font-normal outline-none focus:border-brand"
              value={draft.title ?? ""}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Описание для публикации
            <textarea
              rows={6}
              className="rounded-lg border border-line px-3 py-2 font-normal leading-6 outline-none focus:border-brand"
              value={draft.clean_description ?? ""}
              onChange={(event) => setDraft({ ...draft, clean_description: event.target.value })}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Желаемый результат
            <textarea
              rows={3}
              className="rounded-lg border border-line px-3 py-2 font-normal leading-6 outline-none focus:border-brand"
              value={draft.desired_result ?? ""}
              onChange={(event) => setDraft({ ...draft, desired_result: event.target.value })}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Категория
              <select
                className="min-h-11 rounded-lg border border-line px-3 font-normal outline-none focus:border-brand"
                value={CATEGORIES.includes(draft.category as never) ? draft.category : "другое"}
                onChange={(event) => setDraft({ ...draft, category: event.target.value })}
              >
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Статус
              <select
                className="min-h-11 rounded-lg border border-line px-3 font-normal outline-none focus:border-brand"
                value={draft.status}
                onChange={(event) => setDraft({ ...draft, status: event.target.value as ProblemStatus })}
              >
                {STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {labelStatus(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <button
              disabled={saving}
              onClick={() => onSave(problem, draftPatch("published"))}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-3 font-semibold disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              Опубликовать
            </button>
            <button
              disabled={saving}
              onClick={() => onSave(problem, draftPatch("rejected"))}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-3 font-semibold disabled:opacity-60"
            >
              <X className="h-4 w-4" />
              Отклонить
            </button>
            <button
              disabled={saving}
              onClick={() => onSave(problem, draftPatch())}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-3 font-semibold text-white disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Сохраняем..." : "Сохранить"}
            </button>
          </div>
        </section>
      </div>
    </article>
  );
}

function AdminPhotos({ photos, title }: { photos: string[]; title: string }) {
  return (
    <section className="rounded-xl border border-line bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Фото</p>
        <p className="text-xs text-muted">{photos.length} шт.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {photos.map((photo, index) => (
          <a key={`${photo}-${index}`} href={photo} target="_blank" rel="noreferrer" className="relative overflow-hidden rounded-lg border border-line bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt={`${title} ${index + 1}`} className="aspect-square w-full object-cover" loading="lazy" />
            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
              {index + 1}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 leading-6 text-slate-700">{value}</p>
    </div>
  );
}
