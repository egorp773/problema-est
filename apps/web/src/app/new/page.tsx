"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { CATEGORIES, type ProblemCategory } from "@problema-est/shared";
import { getTelegramUserId } from "@/lib/telegram";

type ProblemForm = {
  city: string;
  address: string;
  category: ProblemCategory;
  raw_description: string;
  photo_url: string;
  desired_result: string;
};

export default function NewProblemPage() {
  const [form, setForm] = useState<ProblemForm>({
    city: "",
    address: "",
    category: CATEGORIES[0],
    raw_description: "",
    photo_url: "",
    desired_result: ""
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/problems", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          created_by_telegram_id: getTelegramUserId()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setMessage("Проблема отправлена на модерацию. После проверки её смогут подтвердить другие люди.");
      setForm({
        city: "",
        address: "",
        category: CATEGORIES[0],
        raw_description: "",
        photo_url: "",
        desired_result: ""
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить проблему");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-6">
      <Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
        <ArrowLeft className="h-4 w-4" />
        Назад
      </Link>

      <h1 className="text-3xl font-bold text-ink">Сообщить проблему</h1>
      <p className="mt-2 text-muted">Опишите ситуацию простыми словами. Перед публикацией текст проверит ИИ и админ.</p>

      <form onSubmit={submit} className="mt-6 grid gap-4 rounded-lg border border-line bg-white p-4 shadow-soft">
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Город
          <input required className="min-h-12 rounded-lg border border-line px-3 font-normal" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Район или адрес
          <input required className="min-h-12 rounded-lg border border-line px-3 font-normal" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Категория
          <select required className="min-h-12 rounded-lg border border-line px-3 font-normal" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ProblemCategory })}>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Описание проблемы
          <textarea required rows={6} className="rounded-lg border border-line px-3 py-3 font-normal leading-6" value={form.raw_description} onChange={(e) => setForm({ ...form, raw_description: e.target.value })} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Ссылка на фото
          <input type="url" className="min-h-12 rounded-lg border border-line px-3 font-normal" placeholder="https://..." value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Что нужно изменить / какой результат нужен
          <textarea required rows={4} className="rounded-lg border border-line px-3 py-3 font-normal leading-6" value={form.desired_result} onChange={(e) => setForm({ ...form, desired_result: e.target.value })} />
        </label>

        {message ? <p className="rounded-lg bg-teal-50 p-3 text-sm text-brand">{message}</p> : null}
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <button disabled={loading} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-lg font-semibold text-white disabled:opacity-60">
          <Send className="h-5 w-5" />
          {loading ? "Отправляем..." : "Отправить на модерацию"}
        </button>
      </form>
    </main>
  );
}
