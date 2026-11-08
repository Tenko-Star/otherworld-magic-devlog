"use client";

export default function ErrorPage({ reset }) {
  return (
    <main className="error-page">
      <h1>暂时无法加载正文</h1>
      <p>请确认 viewer 的上一级目录中有小说章节，并且文件可读。</p>
      <button onClick={reset}>重新加载</button>
    </main>
  );
}
