import "./globals.css";

export const metadata = {
  title: "ChatGPT",
  description: "本地小说阅读器",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
