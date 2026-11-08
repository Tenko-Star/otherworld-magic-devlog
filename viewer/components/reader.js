"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./icon";
import { HISTORY_TITLES, REPLY_PARAGRAPHS } from "@/lib/mock-content";

function DocumentCard({ chapter, onClick }) {
  return (
    <button className="document-card" onClick={onClick} title={chapter.id}>
      <Icon name="document" size={22} />
      <span><strong>{chapter.id}</strong><small>Document</small></span>
    </button>
  );
}

function ChapterText({ content }) {
  const body = content.replace(/\r\n/g, "\n").replace(/^#\s+[^\n]+\n*/, "");
  return body.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => {
    if (/^#{1,6}\s/.test(paragraph)) return <h2 key={index}>{paragraph.replace(/^#{1,6}\s+/, "")}</h2>;
    if (/^[-*_]{3,}$/.test(paragraph.trim())) return <hr key={index} />;
    return <p key={index}>{paragraph}</p>;
  });
}

export default function Reader({ chapters: initialChapters, initialChapter, initialError }) {
  const [chapters, setChapters] = useState(initialChapters);
  const [chapter, setChapter] = useState(initialChapter);
  const [messages, setMessages] = useState(() => initialChapter ? [{ id: "initial", prompt: `继续阅读《魔法程序员》。\n${initialChapter.title}`, chapter: initialChapter, status: "complete" }] : []);
  const [historyTitles, setHistoryTitles] = useState([]);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [outputsOpen, setOutputsOpen] = useState(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(initialError);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef(null);
  const lastMessageRef = useRef(null);
  const outputListRef = useRef(null);
  const activeOutputRef = useRef(null);
  const searchRef = useRef(null);
  const requestRef = useRef(null);
  const refreshRequestRef = useRef(null);
  const copyTimer = useRef(null);
  const chapterIndex = chapters.findIndex((item) => item.id === chapter?.id);
  const searchResults = chapters.filter((item) => `${item.title} ${item.number}`.toLowerCase().includes(search.trim().toLowerCase()));

  useEffect(() => () => {
    requestRef.current?.abort();
    refreshRequestRef.current?.abort();
    clearTimeout(copyTimer.current);
  }, []);

  useEffect(() => {
    const titles = [...HISTORY_TITLES];
    for (let index = titles.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [titles[index], titles[other]] = [titles[other], titles[index]];
    }
    setHistoryTitles(titles.slice(0, 24));
  }, []);

  const lastMessageId = messages.at(-1)?.id;
  useEffect(() => {
    if (lastMessageRef.current && scrollRef.current) {
      const top = lastMessageRef.current.getBoundingClientRect().top - scrollRef.current.getBoundingClientRect().top + scrollRef.current.scrollTop;
      scrollRef.current.scrollTo({ top: Math.max(0, top - 24) });
    }
  }, [lastMessageId]);

  useEffect(() => {
    const list = outputListRef.current;
    if (!list) return;
    const centerCurrent = () => {
      const active = activeOutputRef.current;
      if (!active || !list.clientHeight) return;
      list.scrollTo({ top: active.offsetTop + active.offsetHeight / 2 - list.clientHeight / 2 });
    };
    centerCurrent();
    const observer = new ResizeObserver(centerCurrent);
    observer.observe(list);
    return () => observer.disconnect();
  }, [chapter?.id, chapters, outputsOpen]);

  function toggleSidebar() {
    if (window.matchMedia("(max-width: 900px)").matches) setMobileOpen((value) => !value);
    else setSidebarOpen((value) => !value);
  }

  function openSearch() {
    setSearch("");
    searchRef.current?.showModal();
  }

  function toggleOutputs() {
    setOutputsOpen((value) => !(value ?? window.matchMedia("(min-width: 1700px)").matches));
  }

  async function selectChapter(item) {
    if (!item) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setMessages((items) => items.filter((message) => message.status !== "thinking"));
    setNotice("");
    setCopied(false);
    setMobileOpen(false);
    searchRef.current?.close();
    try {
      const response = await fetch(`/api/chapters/${encodeURIComponent(item.id)}`, { signal: controller.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "章节读取失败。");
      if (controller.signal.aborted) return;
      setChapter(data.chapter);
      setMessages([{ id: crypto.randomUUID(), prompt: `继续阅读《魔法程序员》。\n${data.chapter.title}`, chapter: data.chapter, status: "complete" }]);
      setQuery("");
      window.history.replaceState(null, "", `?chapter=${encodeURIComponent(item.id)}`);
      scrollRef.current?.scrollTo({ top: 0 });
    } catch (error) {
      if (error.name !== "AbortError") setNotice(error.message || "连接失败，请重试。");
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  async function refreshChapters() {
    if (refreshRequestRef.current) return;
    const controller = new AbortController();
    refreshRequestRef.current = controller;
    setRefreshing(true);
    setNotice("");
    try {
      const response = await fetch("/api/chapters", { cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "目录刷新失败。");
      if (controller.signal.aborted) return;
      setChapters(data.chapters);
      setNotice(`章节目录已刷新，共 ${data.chapters.length} 章。`);
    } catch (error) {
      if (error.name !== "AbortError") setNotice(error.message || "目录刷新失败，请重试。");
    } finally {
      if (refreshRequestRef.current === controller) {
        refreshRequestRef.current = null;
        setRefreshing(false);
      }
    }
  }

  function newChat() {
    requestRef.current?.abort();
    requestRef.current = null;
    setLoading(false);
    setChapter(null);
    setMessages([]);
    setQuery("");
    setNotice("");
    setMobileOpen(false);
    window.history.replaceState(null, "", window.location.pathname);
  }

  async function submit(event) {
    event.preventDefault();
    const value = query.trim();
    if (!value || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const id = crypto.randomUUID();
    const command = value.toLowerCase();
    const isNavigation = command === "/next" || command === "/prev";
    const target = chapters[chapterIndex + (command === "/prev" ? -1 : 1)];
    setMessages((items) => [...items, { id, prompt: value, status: "thinking" }]);
    setQuery("");
    setNotice("");
    setLoading(true);
    setThinkingSeconds(0);
    const started = Date.now();
    const ticker = setInterval(() => setThinkingSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    try {
      await new Promise((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(new DOMException("Cancelled", "AbortError"));
        };
        const timer = setTimeout(() => {
          controller.signal.removeEventListener("abort", abort);
          resolve();
        }, 20000);
        controller.signal.addEventListener("abort", abort, { once: true });
      });
      if (controller.signal.aborted) return;
      let reply;
      let nextChapter;
      if (isNavigation) {
        if (chapter && chapterIndex < 0) throw new Error("当前章节已不在目录中，请从右侧重新选择章节。");
        if (!target) throw new Error(command === "/prev" ? "已经是第一章，没有上一章了。" : "没有下一章了，可以点击 Outputs 旁的＋刷新目录。");
        const response = await fetch(`/api/chapters/${encodeURIComponent(target.id)}`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "章节读取失败。");
        if (controller.signal.aborted) return;
        nextChapter = data.chapter;
        setChapter(nextChapter);
        window.history.replaceState(null, "", `?chapter=${encodeURIComponent(nextChapter.id)}`);
      } else {
        const paragraphs = [...REPLY_PARAGRAPHS];
        const count = 1 + Math.floor(Math.random() * 7);
        const selected = [];
        for (let index = 0; index < count; index++) {
          selected.push(paragraphs.splice(Math.floor(Math.random() * paragraphs.length), 1)[0]);
        }
        reply = selected.join("\n\n");
      }
      setMessages((items) => items.map((message) => message.id === id ? { ...message, status: "complete", reply, chapter: nextChapter, seconds: Math.floor((Date.now() - started) / 1000) } : message));
    } catch (error) {
      if (error.name !== "AbortError") setMessages((items) => items.map((message) => message.id === id ? { ...message, status: "error", reply: error.message || "回复失败，请重试。", seconds: Math.floor((Date.now() - started) / 1000) } : message));
    } finally {
      clearInterval(ticker);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  async function copyText(text, messageId = null) {
    try {
      await navigator.clipboard.writeText(text);
      if (messageId) {
        setCopied(messageId);
        clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 2000);
      } else setNotice("当前页面链接已复制。");
    } catch {
      setNotice("复制失败，请使用浏览器手动复制。");
    }
  }

  return (
    <div className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"} ${mobileOpen ? "mobile-open" : ""} ${outputsOpen === true ? "outputs-visible" : outputsOpen === false ? "outputs-hidden" : ""}`}>
      <nav className="app-rail" aria-label="应用导航">
        <button className="rail-button home-button" title="首页" aria-label="首页" onClick={newChat}><Icon name="home" size={23} /></button>
        <button className="rail-button" title="章节文档" aria-label="章节文档" onClick={openSearch}><Icon name="library" size={22} /></button>
        <button className="rail-button" title="章节列表" aria-label="章节列表" onClick={openSearch}><Icon name="clock" size={21} /></button>
        <span className="rail-button decorative"><Icon name="discover" size={21} /></span>
        <span className="rail-button decorative"><Icon name="more" /></span>
        <div className="rail-divider" />
        <button className="rail-button" title="Outputs" aria-label="打开文档面板" onClick={toggleOutputs}><Icon name="folder" size={21} /></button>
        <span className="rail-button decorative"><Icon name="code" size={22} /></span>
        <div className="rail-bottom">
          <span className="rail-button decorative"><Icon name="progress" size={29} /></span>
          <div className="profile-avatar" title="个人头像"><img src="/avatar.png" alt="个人头像" width="24" height="24" /></div>
        </div>
      </nav>

      {mobileOpen && <button className="sidebar-backdrop" aria-label="关闭侧栏" onClick={() => setMobileOpen(false)} />}
      <aside className="sidebar" aria-label="历史对话侧栏">
        <div className="sidebar-header">
          <button className="brand" onClick={newChat}>ChatGPT</button>
          <button className="icon-button" title="搜索章节" aria-label="搜索章节" onClick={openSearch}><Icon name="search" size={19} /></button>
          <button className="icon-button" title="收起侧栏" aria-label="收起侧栏" onClick={toggleSidebar}><Icon name="panel" size={19} /></button>
        </div>
        <div className="sidebar-scroll">
          <button className="sidebar-action" onClick={newChat}><Icon name="edit" size={19} /><span>New chat</span></button>
          <div className="sidebar-action claudy"><span className="claudy-mark" aria-hidden="true"><i /><i /></span><span>Claudy</span></div>
          <div className="sidebar-section-label">Projects</div>
          <div className="no-projects">No projects</div>
          <div className="sidebar-section-label recents-label">Recents</div>
          {historyTitles.map((title, index) => (
            <div key={title} className={`recent-item ${index === 0 ? "active" : ""}`} title={title}>
              <span>{title}</span>
            </div>
          ))}
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button expand-sidebar" title="展开侧栏" aria-label="展开侧栏" onClick={toggleSidebar}><Icon name="panel" /></button>
            <button className="conversation-title" onClick={openSearch}><span>{historyTitles[0] || "ChatGPT"}</span><Icon name="chevron" size={12} /></button>
          </div>
          <div className="topbar-actions">
            <button className="share-button" onClick={() => copyText(window.location.href)}><Icon name="share" size={18} /><span>Share</span></button>
            <button className="icon-button outputs-toggle" title="Outputs" aria-label="切换文档面板" onClick={toggleOutputs}><Icon name="outputs" size={21} /></button>
          </div>
        </header>

        <div className="conversation-scroll" ref={scrollRef} aria-busy={loading}>
          <div className={`conversation ${!messages.length ? "empty-conversation" : ""}`}>
            {!messages.length ? (
              <section className="welcome">
                <h1>What can I help with?</h1>
                <div className="chapter-suggestions">{chapters.map((item) => <button key={item.id} onClick={() => selectChapter(item)}><Icon name="document" size={18} /><span>{item.title}</span></button>)}</div>
                {!chapters.length && <p>还没有可阅读的章节。</p>}
              </section>
            ) : (
              <>
                {messages.map((message, index) => (
                <div className="chat-turn" key={message.id} ref={index === messages.length - 1 ? lastMessageRef : null}>
                <div className="user-message">{message.prompt}</div>
                <section className="assistant-message">
                  <div className="work-status"><span>{message.status === "thinking" ? `思考中 · ${thinkingSeconds}s` : message.seconds ? `已思考 ${message.seconds} 秒` : "已加载文档"}</span><Icon name="right" size={16} /></div>
                  {message.status === "thinking" ? (
                    <div className="thinking-process" role="status" aria-label="正在准备回复">
                      {["正在整理输入", "正在准备内容", "正在组织回复", "即将完成"].slice(0, Math.min(4, Math.floor(thinkingSeconds / 5) + 1)).map((step, stepIndex) => <div className="thinking-step" key={step}><span className={stepIndex === Math.min(3, Math.floor(thinkingSeconds / 5)) ? "thinking-dot" : "thinking-done"} />{step}…</div>)}
                      <div className="thinking-track"><span style={{ width: `${Math.min(95, thinkingSeconds * 5)}%` }} /></div>
                    </div>
                  ) : (
                  <>
                  {message.chapter ? (
                    <>
                      <div className="document-intro"><span>正文已加载，共约 <strong>{message.chapter.content.replace(/\s/g, "").length.toLocaleString("zh-CN")} 字</strong>。</span></div>
                      <DocumentCard chapter={message.chapter} onClick={() => document.getElementById(`text-${message.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} />
                      <article className="chapter-content" id={`text-${message.id}`}>
                        <h1>{message.chapter.title}</h1>
                        <ChapterText content={message.chapter.content} />
                      </article>
                    </>
                  ) : <div className="chapter-content simulated-reply"><ChapterText content={message.reply || ""} /></div>}
                  <div className="message-actions">
                    <button className="icon-button" title={copied === message.id ? "已复制" : "复制正文"} aria-label="复制正文" onClick={() => copyText(message.chapter?.content || message.reply, message.id)}><Icon name={copied === message.id ? "check" : "copy"} size={18} /></button>
                    <span className="feedback-icons" aria-hidden="true"><Icon name="like" size={17} /><Icon name="dislike" size={17} /></span>
                    <span className="decorative" aria-hidden="true"><Icon name="volume" size={19} /></span>
                    <button className="icon-button" title="复制当前链接" aria-label="复制当前链接" onClick={() => copyText(window.location.href)}><Icon name="share" size={18} /></button>
                    <button className="icon-button" title="选择章节" aria-label="选择章节" onClick={openSearch}><Icon name="more" size={18} /></button>
                  </div>
                  </>
                  )}
                </section>
                </div>
                ))}
                  {chapter && <nav className="chapter-pagination" aria-label="前后章节">
                    <button disabled={chapterIndex <= 0 || loading} onClick={() => selectChapter(chapters[chapterIndex - 1])}><span>←</span> 上一章</button>
                    <span>{chapterIndex < 0 ? "当前章节已不在目录中" : `${chapterIndex + 1} / ${chapters.length}`}</span>
                    <button disabled={chapterIndex < 0 || chapterIndex >= chapters.length - 1 || loading} onClick={() => selectChapter(chapters[chapterIndex + 1])}>下一章 <span>→</span></button>
                  </nav>}
              </>
            )}
          </div>
        </div>

        <aside className="outputs-panel" aria-label="文档面板">
          <div className="panel-heading"><span>Outputs</span><button className="icon-button" aria-label="刷新章节目录" title={refreshing ? "正在刷新目录…" : "刷新章节目录"} disabled={refreshing} onClick={refreshChapters}><Icon name="plus" size={18} /></button></div>
          <div className="output-list" ref={outputListRef} aria-busy={refreshing}>{chapters.map((item) => <button key={item.id} ref={chapter?.id === item.id ? activeOutputRef : null} aria-current={chapter?.id === item.id ? "page" : undefined} className={`output-item ${chapter?.id === item.id ? "current-output" : ""}`} title={item.id} onClick={() => selectChapter(item)}><Icon name="document" size={15} /><span>{item.id}</span><small>Doc</small></button>)}</div>
          <button className="show-more" onClick={openSearch}><Icon name="chevron" size={14} /><span>Show more</span></button>
          <div className="panel-heading sources-heading"><span>Sources</span><button className="icon-button" aria-label="浏览来源章节" title="浏览来源章节" onClick={openSearch}><Icon name="plus" size={18} /></button></div>
          <button className="source-item" onClick={openSearch}><Icon name="library" size={18} /><span>Library</span></button>
          <button className="source-item" onClick={openSearch}><Icon name="attachment" size={18} /><span>Files</span></button>
        </aside>

        <div className="composer-area">
          {!!messages.length && <button className="scroll-bottom" aria-label="滚动到对话末尾" title="对话末尾" onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}><Icon name="arrowDown" size={21} /></button>}
          <div className={`composer-notice ${notice ? "has-notice" : ""}`} role="status">{notice}<button className="icon-button" aria-label="关闭提示" onClick={() => setNotice("")}><Icon name="close" size={14} /></button></div>
          <form className="composer" onSubmit={submit}>
            <textarea rows={1} placeholder="Work with ChatGPT" aria-label="输入消息，或使用 /next、/prev 切换章节" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit(event);
              }
            }} />
            <div className="composer-toolbar">
              <button type="button" className="icon-button add-button" title="选择章节" aria-label="选择章节" onClick={openSearch}><Icon name="plus" size={23} /></button>
              <div className="composer-options">
                <span className="model-label"><Icon name="bolt" size={15} /><span>GPT-6 Astra <span className="light-label">Light</span></span><Icon name="chevron" size={13} /></span>
                <span className="microphone decorative" aria-hidden="true"><Icon name="microphone" size={20} /></span>
                <button type={query.trim() ? "submit" : "button"} className={`send-button ${query.trim() ? "has-query" : ""}`} disabled={loading} title={loading ? "正在回复…" : query.trim() ? "发送消息" : "选择章节"} aria-label={loading ? "正在回复" : query.trim() ? "发送消息" : "选择章节"} onClick={query.trim() ? undefined : openSearch}><Icon name={query.trim() ? "arrowUp" : "voice"} size={21} /></button>
              </div>
            </div>
          </form>
        </div>
      </main>

      <dialog className="search-dialog" ref={searchRef} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }} aria-labelledby="search-title">
        <div className="search-dialog-header"><h2 id="search-title">搜索章节</h2><button className="icon-button" aria-label="关闭搜索" onClick={() => searchRef.current.close()}><Icon name="close" /></button></div>
        <div className="search-input"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索标题或章节序号" aria-label="搜索标题或章节序号" autoFocus /></div>
        <div className="search-results">{searchResults.map((item) => <button key={item.id} onClick={() => selectChapter(item)}><Icon name="document" size={20} /><span>{item.title}</span><Icon name="right" size={16} /></button>)}{!searchResults.length && <p>未找到匹配章节。</p>}</div>
      </dialog>
    </div>
  );
}
