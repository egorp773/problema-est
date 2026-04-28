"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ImagePlus, Send, X } from "lucide-react";
import { CATEGORIES, type ProblemCategory } from "@problema-est/shared";
import { getLocalCitySuggestions, mergeSuggestions } from "@/lib/geo";
import { rememberCreatedProblem } from "@/lib/local-actions";
import { getTelegramIdentity } from "@/lib/telegram";

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
  const [citySuggestionsFromApi, setCitySuggestionsFromApi] = useState<string[]>([]);
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const citySuggestions = useMemo(
    () => mergeSuggestions(getLocalCitySuggestions(form.city, 8), citySuggestionsFromApi).slice(0, 8),
    [citySuggestionsFromApi, form.city]
  );

  useEffect(() => {
    const query = form.city.trim();
    if (!query) {
      setCitySuggestionsFromApi([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/suggestions?type=city&q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        const data = await response.json();
        if (response.ok) setCitySuggestionsFromApi(data.suggestions ?? []);
      } catch (err) {
        if (!controller.signal.aborted) setCitySuggestionsFromApi([]);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [form.city]);

  useEffect(() => {
    const city = form.city.trim();
    const query = form.address.trim();
    if (!city || query.length < 2) {
      setAddressSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          type: "address",
          city,
          q: query
        });
        const response = await fetch(`/api/suggestions?${params.toString()}`, {
          signal: controller.signal
        });
        const data = await response.json();
        if (response.ok) setAddressSuggestions(data.suggestions ?? []);
      } catch (err) {
        if (!controller.signal.aborted) setAddressSuggestions([]);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [form.address, form.city]);

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
      const identity = await getTelegramIdentity();
      const response = await fetch("/api/problems", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          photo_url: uploadedPhotoUrls[0] || "",
          photo_urls: uploadedPhotoUrls,
          created_by_telegram_id: identity.telegramUserId,
          created_by_anonymous_key: identity.anonymousKey
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.problem?.id) rememberCreatedProblem(String(data.problem.id));

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
        <SuggestInput
          label="Город"
          value={form.city}
          placeholder="Начните вводить: Москва, Мурманск..."
          suggestions={citySuggestions}
          onChange={(value) => setForm({ ...form, city: value })}
          onSelect={(value) => setForm({ ...form, city: value })}
        />
        <SuggestInput
          label="Район или адрес"
          value={form.address}
          placeholder="Улица, дом или район"
          suggestions={addressSuggestions}
          onChange={(value) => setForm({ ...form, address: value })}
          onSelect={(value) => setForm({ ...form, address: value })}
          helper={form.city.trim() ? "Подсказки берутся из уже опубликованных проблем в этом городе." : "Сначала выберите город."}
        />
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

function SuggestInput({
  label,
  value,
  placeholder,
  suggestions,
  helper,
  onChange,
  onSelect
}: {
  label: string;
  value: string;
  placeholder?: string;
  suggestions: string[];
  helper?: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const visibleSuggestions = focused && value.trim().length > 0 ? suggestions : [];

  return (
    <div className="relative grid gap-2 text-sm font-semibold text-ink">
      <label className="grid gap-2">
        {label}
        <input
          required
          className="min-h-12 rounded-lg border border-line px-3 font-normal outline-none focus:border-brand"
          placeholder={placeholder}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>

      {visibleSuggestions.length > 0 ? (
        <div className="absolute left-0 right-0 top-[74px] z-20 overflow-hidden rounded-xl border border-line bg-white shadow-soft">
          {visibleSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(suggestion);
                setFocused(false);
              }}
              className="block min-h-11 w-full border-b border-line px-3 text-left text-sm font-normal text-ink last:border-b-0 active:bg-teal-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      {helper ? <p className="text-xs font-normal text-muted">{helper}</p> : null}
    </div>
  );
}
