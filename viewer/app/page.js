import { listChapters, readChapter } from "@/lib/chapters";
import Reader from "@/components/reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }) {
  const chapters = await listChapters();
  const query = await searchParams;
  const id = typeof query.chapter === "string" ? query.chapter : chapters[0]?.id;
  const chapter = id ? await readChapter(id) : null;

  return <Reader chapters={chapters} initialChapter={chapter} initialError={id && !chapter ? "未找到该章节，请从右侧选择其他章节。" : ""} />;
}
