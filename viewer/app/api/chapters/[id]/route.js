import { readChapter } from "@/lib/chapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const chapter = await readChapter(id);
    if (!chapter) return Response.json({ error: "未找到该章节。" }, { status: 404 });
    return Response.json({ chapter }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "章节读取失败，请稍后重试。" }, { status: 500 });
  }
}
