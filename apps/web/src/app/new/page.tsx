"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ImagePlus, Send, X } from "lucide-react";
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhotoFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : "");
    if (file) setForm((current) => ({ ...current, photo_url: "" }));
  }

  async function uploadPhoto() {
    if (!photoFile) return form.photo_url.trim();

    const uploadData = new FormData();
    uploadData.append("file", photoFile);
    const response = await fetch("/api/uploads", {
      method: "POST",
      body: uploadData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Не удалось загрузить фото.");
    return String(data.url);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const uploadedPhotoUrl = await uploadPhoto();
      const response = await fetch("/api/problems", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          photo_url: uploadedPhotoUrl,
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
      setPhotoFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить проблему");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-[#f7f8fa] px-4 py-6">
      <Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
        <ArrowLeft className="h-4 w-4" />
        Назад
      </Link>

      <h1 className="text-3xl font-bold text-ink">Сообщить проблему</h1>
      <p className="mt-2 text-muted">Опишите ситуацию простыми словами. Перед публикацией текст проверит ИИ и админ.</p>

      <form onSubmit={submit} className="mt-6 grid gap-4 rounded-xl border border-line bg-white p-4 shadow-soft">
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Город
          <input required className="min-h-12 rounded-lg border border-line px-3 font-normal outline-none focus:border-brand" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Район или адрес
          <input required className="min-h-12 rounded-lg border border-line px-3 font-normal outline-none focus:border-brand" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Категория
          <select required className="min-h-12 rounded-lg border border-line px-3 font-normal outline-none focus:border-brand" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ProblemCategory })}>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Описание проблемы
          <textarea required rows={6} className="rounded-lg border border-line px-3 py-3 font-normal leading-6 outline-none focus:border-brand" value={form.raw_description} onChange={(event) => setForm({ ...form, raw_description: event.target.value })} />
        </label>

        <section className="grid gap-2">
          <p className="text-sm font-semibold text-ink">Фото</p>
          {previewUrl ? (
            <div className="relative overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="" className="max-h-80 w-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  setPhotoFile(null);
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl("");
                }}
                className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink"
                aria-label="Убрать фото"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-slate-50 px-4 text-center text-sm font-semibold text-ink">
              <ImagePlus className="h-7 w-7 text-brand" />
              Загрузить фото с телефона
              <span className="text-xs font-normal text-muted">JPG, PNG, WebP, HEIC до 8 МБ</span>
              <input type="file" accept="image/*" className="hidden" onChange={choosePhoto} />
            </label>
          )}
          <input
            type="url"
            className="min-h-11 rounded-lg border border-line px-3 text-sm outline-none focus:border-brand"
            placeholder="Или вставьте ссылку на фото"
            value={form.photo_url}
            onChange={(event) => setForm({ ...form, photo_url: event.target.value })}
            disabled={Boolean(photoFile)}
          />
        </section>

        <label className="grid gap-2 text-sm font-semibold text-ink">
          Что нужно изменить / какой результат нужен
          <textarea required rows={4} className="rounded-lg border border-line px-3 py-3 font-normal leading-6 outline-none focus:border-brand" value={form.desired_result} onChange={(event) => setForm({ ...form, desired_result: event.target.value })} />
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
