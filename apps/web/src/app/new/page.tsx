"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ImagePlus, Send, X } from "lucide-react";
import { CATEGORIES, type ProblemCategory } from "@problema-est/shared";
import { ensureAnonymousKey, getTelegramUserId } from "@/lib/telegram";

type ProblemForm = {
  city: string;
  address: string;
  category: ProblemCategory;
  raw_description: string;
  photo_url: string;
  desired_result: string;
};

type PhotoPreview = {
  file: File;
  url: string;
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
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, Math.max(10 - photos.length, 0));
    if (files.length === 0) return;

    setPhotos((current) => [
      ...current,
      ...files.map((file) => ({
        file,
        url: URL.createObjectURL(file)
      }))
    ].slice(0, 10));
    setForm((current) => ({ ...current, photo_url: "" }));
    event.target.value = "";
  }

  async function uploadPhotos() {
    const urls: string[] = [];

    for (const photo of photos) {
      const uploadData = new FormData();
      uploadData.append("file", photo.file);
      const response = await fetch("/api/uploads", {
        method: "POST",
        body: uploadData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить фото.");
      urls.push(String(data.url));
    }

    if (form.photo_url.trim()) urls.push(form.photo_url.trim());
    return urls.slice(0, 10);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const uploadedPhotoUrls = await uploadPhotos();
      const telegramUserId = getTelegramUserId();
      const response = await fetch("/api/problems", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          photo_url: uploadedPhotoUrls[0] || "",
          photo_urls: uploadedPhotoUrls,
          created_by_telegram_id: telegramUserId,
          created_by_anonymous_key: telegramUserId ? null : ensureAnonymousKey()
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
      photos.forEach((photo) => URL.revokeObjectURL(photo.url));
      setPhotos([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить проблему");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-[#f7f8fa] px-4 pb-28 pt-6">
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
          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo, index) => (
                <div key={photo.url} className="relative overflow-hidden rounded-lg border border-line bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="" className="aspect-square w-full object-cover" />
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(photo.url);
                      setPhotos((current) => current.filter((item) => item.url !== photo.url));
                    }}
                    className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink"
                    aria-label="Убрать фото"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {photos.length < 10 ? (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-slate-50 text-center text-xs font-semibold text-ink">
                  <ImagePlus className="h-6 w-6 text-brand" />
                  Ещё
                  <input type="file" accept="image/*" multiple className="hidden" onChange={choosePhoto} />
                </label>
              ) : null}
            </div>
          ) : null}
          {photos.length === 0 ? (
            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-slate-50 px-4 text-center text-sm font-semibold text-ink">
              <ImagePlus className="h-7 w-7 text-brand" />
              Загрузить фото с телефона
              <span className="text-xs font-normal text-muted">До 10 фото, JPG/PNG/WebP/HEIC до 8 МБ каждое</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={choosePhoto} />
            </label>
          ) : null}
          <input
            type="url"
            className="min-h-11 rounded-lg border border-line px-3 text-sm outline-none focus:border-brand"
            placeholder="Или вставьте ссылку на одно фото"
            value={form.photo_url}
            onChange={(event) => setForm({ ...form, photo_url: event.target.value })}
            disabled={photos.length > 0}
          />
          <p className="text-xs text-muted">{photos.length}/10 фото выбрано</p>
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
