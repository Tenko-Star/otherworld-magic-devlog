import { listChapters } from "@/lib/chapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ chapters: await listChapters() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "无法读取章节目录，请检查小说文件是否存在。" }, { status: 500 });
  }
}
