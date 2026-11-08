import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const novelDirectory = path.resolve(process.cwd(), "..");
const chapterPattern = /^第([零〇一二三四五六七八九十百千万两\d]+)章[_\s].+\.md$/u;

function chapterNumber(value) {
  if (/^\d+$/.test(value)) return Number(value);
  const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const units = { 十: 10, 百: 100, 千: 1000 };
  let total = 0;
  let section = 0;
  let digit = 0;

  for (const character of value) {
    if (character in digits) {
      digit = digits[character];
    } else if (character === "万") {
      total += (section + digit) * 10000;
      section = 0;
      digit = 0;
    } else {
      section += (digit || 1) * units[character];
      digit = 0;
    }
  }
  return total + section + digit;
}

export async function listChapters() {
  const entries = await readdir(novelDirectory, { withFileTypes: true });
  const chapters = entries.flatMap((entry) => {
    const match = entry.isFile() && chapterPattern.exec(entry.name);
    if (!match) return [];
    return [{
      id: entry.name,
      number: chapterNumber(match[1]),
      title: entry.name.replace(/\.md$/, "").replace(/[_\s]+/g, " "),
    }];
  });
  return chapters.sort((a, b) => a.number - b.number || a.id.localeCompare(b.id, "zh-CN"));
}

export async function readChapter(id) {
  // Only files discovered in the chapter directory can be read. A request can
  // never supply an arbitrary filesystem path or access db/ and temp/.
  const chapters = await listChapters();
  const chapter = chapters.find((item) => item.id === id);
  if (!chapter) return null;

  try {
    const content = (await readFile(path.join(novelDirectory, chapter.id), "utf8")).replace(/^\uFEFF/, "");
    const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() || chapter.title;
    return { ...chapter, title, content };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
