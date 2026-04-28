import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const bucket = "problem-photos";
const maxSize = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл не найден." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Можно загружать только изображения." }, { status: 400 });
    }
    if (file.size > maxSize) {
      return NextResponse.json({ error: "Фото слишком большое. Максимум 8 МБ." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error: bucketError } = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: maxSize,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]
    });

    if (bucketError && !bucketError.message.toLowerCase().includes("already exists")) {
      throw bucketError;
    }

    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType: file.type,
      upsert: false
    });
    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl, path });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить фото" },
      { status: 500 }
    );
  }
}
