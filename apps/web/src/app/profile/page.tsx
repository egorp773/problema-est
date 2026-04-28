"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, FileText, Loader2, Plus, UserRound } from "lucide-react";
import { PUBLIC_STATUSES, type Problem, type ProblemStatus } from "@problema-est/shared";
import { labelStatus } from "@/lib/format";
import { ensureAnonymousKey, getTelegramDisplayName, waitForTelegramUser, type TelegramUser } from "@/lib/telegram";

type ProfileStats = {
  created: number;
  confirmed: number;
  followed: number;
  resolved: number;
};

type ProfileData = {
  stats: ProfileStats;
  createdProblems: Problem[];
  confirmedProblems: Problem[];
  followedProblems: Problem[];
};

type Tab = "created" | "confirmed" | "followed";

const emptyData: ProfileData = {
  stats: {
    created: 0,
    confirmed: 0,
    followed: 0,
    resolved: 0
  },
  createdProblems: [],
  confirmedProblems: [],
  followedProblems: []
};

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "created", label: "Мои проблемы" },
  { id: "confirmed", label: "Подтвердил" },
  { id: "followed", label: "Отслеживаю" }
];

function isPublicStatus(status: ProblemStatus | string) {
  return PUBLIC_STATUSES.includes(status as never);
}

export default function ProfilePage() {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [data, setData] = useState<ProfileData>(emptyData);
  const [activeTab, setActiveTab] = useState<Tab>("created");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const displayName = useMemo(() => getTelegramDisplayName(user), [user]);
  const username = user?.username ? `@${user.username}` : "";

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const telegramUser = await waitForTelegramUser();
      const telegramUserId = telegramUser?.id ? String(telegramUser.id) : null;
      const anonymousKey = ensureAnonymousKey();
      const params = new URLSearchParams();

      if (telegramUserId) params.set("telegram_user_id", telegramUserId);
      params.set("anonymous_key", anonymousKey);
      setUser(telegramUser);

      const response = await fetch(`/api/profile?${params.toString()}`, {
        cache: "no-store",
        headers: {
          "cache-control": "no-cache"
        }
      });
      const profileData = await response.json();
      if (!response.ok) throw new Error(profileData.error || "Не удалось загрузить профиль.");

      setData({
        stats: profileData.stats ?? emptyData.stats,
        createdProblems: profileData.createdProblems ?? [],
        confirmedProblems: profileData.confirmedProblems ?? [],
        followedProblems: profileData.followedProblems ?? []
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить профиль.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();
    void loadProfile();
  }, []);

  const activeProblems =
    activeTab === "created"
      ? data.createdProblems
      : activeTab === "confirmed"
        ? data.confirmedProblems
        : data.followedProblems;

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-[#f7f8fa] px-4 pb-28 pt-5">
      <section className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <div className="flex items-center gap-4">
          {user?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photo_url} alt={displayName} className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-brand">
              <UserRound className="h-8 w-8" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-ink">{displayName}</h1>
            <p className="mt-1 truncate text-sm font-semibold text-brand">{username || "username не указан"}</p>
            <p className="mt-1 text-sm leading-5 text-muted">Ваш вклад в проблемы, которые становятся видимыми.</p>
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <StatCard label="Создано проблем" value={data.stats.created} />
        <StatCard label="Подтверждено" value={data.stats.confirmed} />
        <StatCard label="Отслеживается" value={data.stats.followed} />
        <StatCard label="Решено" value={data.stats.resolved} />
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-white p-2 shadow-soft">
        <div className="grid grid-cols-3 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-11 rounded-xl px-2 text-sm font-semibold ${
                activeTab === tab.id ? "bg-teal-50 text-brand" : "text-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-line bg-white p-5 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          Загрузка профиля...
        </div>
      ) : (
        <ProblemList tab={activeTab} problems={activeProblems} />
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-sm leading-5 text-muted">{label}</p>
    </div>
  );
}

function ProblemList({ tab, problems }: { tab: Tab; problems: Problem[] }) {
  if (problems.length === 0) {
    const text =
      tab === "created"
        ? "Вы пока не создавали проблемы."
        : tab === "confirmed"
          ? "Вы пока не подтверждали проблемы."
          : "Вы пока не отслеживаете проблемы.";

    return (
      <section className="mt-5 rounded-2xl border border-line bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-brand">
          {tab === "created" ? <FileText className="h-6 w-6" /> : tab === "confirmed" ? <CheckCircle2 className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
        </div>
        <p className="mt-3 text-sm font-semibold text-ink">{text}</p>
        {tab === "created" ? (
          <Link href="/new" className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 font-semibold text-white">
            <Plus className="h-4 w-4" />
            Сообщить проблему
          </Link>
        ) : null}
      </section>
    );
  }

  return (
    <section className="mt-5 grid gap-3">
      {problems.map((problem) => (
        <ProblemRow key={problem.id} problem={problem} tab={tab} />
      ))}
    </section>
  );
}

function ProblemRow({ problem, tab }: { problem: Problem; tab: Tab }) {
  const publicProblem = isPublicStatus(problem.status);

  return (
    <article className="rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="line-clamp-2 text-base font-bold leading-6 text-ink">{problem.title || "Без заголовка"}</h2>
          <p className="mt-1 truncate text-sm text-muted">
            {problem.city} · {problem.category}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-brand">
          {labelStatus(problem.status)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{problem.confirmations_count} подтверждений</p>
        {publicProblem ? (
          <Link href={`/problems/${problem.id}`} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white">
            Открыть
          </Link>
        ) : tab === "created" && problem.status === "pending" ? (
          <span className="text-sm font-semibold text-muted">На проверке</span>
        ) : tab === "created" && problem.status === "rejected" ? (
          <span className="text-sm font-semibold text-muted">Отклонено</span>
        ) : null}
      </div>
    </article>
  );
}
