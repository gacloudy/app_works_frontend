import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import type { Route } from "./+types/chat";
import { backendFetch } from "../utils/backend.server";

export function meta() {
  return [{ title: "株本赤音ちゃん" }];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const message = String(formData.get("message") ?? "");
  const history: ChatMessage[] = JSON.parse(String(formData.get("history") ?? "[]"));

  const res = await backendFetch("/api/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  if (!res.ok) {
    return { reply: "エラーが発生しました。しばらくしてから再度お試しください。" };
  }

  const data: { reply: string } = await res.json();
  return { reply: data.reply };
}

const TALK_SWAP_INTERVAL_MS = 500;
const MAX_TEXTAREA_LINES = 5;

export default function Chat() {
  const fetcher = useFetcher<typeof action>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTalking, setIsTalking] = useState(false);
  const [talkFrame, setTalkFrame] = useState<0 | 1>(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const talkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const talkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoading = fetcher.state !== "idle";

  function submitMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    const historyForRequest = messages;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");

    fetcher.submit(
      { message: text, history: JSON.stringify(historyForRequest) },
      { method: "post" }
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitMessage();
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Shift+Enterは改行、Enter単体は送信（IME変換確定時のEnterは無視する）
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submitMessage();
    }
  }

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.reply) {
      setMessages((prev) => {
        const last = prev.at(-1);
        if (last?.role === "assistant" && last.content === fetcher.data!.reply) {
          return prev;
        }
        return [...prev, { role: "assistant", content: fetcher.data!.reply }];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data, fetcher.state]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // 実際のフォント指標から「4行ぶんの高さ」を計算し、5行目からスクロールバーが出るようにする
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const style = window.getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight);
    const verticalExtras =
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom) +
      parseFloat(style.borderTopWidth) +
      parseFloat(style.borderBottomWidth);
    el.style.maxHeight = `${lineHeight * (MAX_TEXTAREA_LINES - 1) + verticalExtras}px`;
  }, []);

  // 改行に合わせてテキストエリアの高さを自動調整する（最大高さは上記で設定したmax-heightでクランプ）
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const style = window.getComputedStyle(el);
    // box-sizing: border-box のため、scrollHeight（ボーダー分を含まない）に
    // ボーダー幅を足してからheightに設定しないと、常に数px分あふれてスクロールバーが出てしまう
    const borderExtras =
      parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + borderExtras}px`;
  }, [input]);

  // AIの返答が届いたら、返答の長さに応じた時間だけ画像を切り替えて喋っているように見せる
  useEffect(() => {
    const last = messages.at(-1);
    if (last?.role !== "assistant") return;

    if (talkIntervalRef.current) clearInterval(talkIntervalRef.current);
    if (talkTimeoutRef.current) clearTimeout(talkTimeoutRef.current);

    setIsTalking(true);
    setTalkFrame(1);
    talkIntervalRef.current = setInterval(() => {
      setTalkFrame((f) => (f === 0 ? 1 : 0));
    }, TALK_SWAP_INTERVAL_MS);

    const talkDuration = Math.min(Math.max(last.content.length * 90, 1500), 8000);
    talkTimeoutRef.current = setTimeout(() => {
      if (talkIntervalRef.current) clearInterval(talkIntervalRef.current);
      setIsTalking(false);
      setTalkFrame(0);
    }, talkDuration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    return () => {
      if (talkIntervalRef.current) clearInterval(talkIntervalRef.current);
      if (talkTimeoutRef.current) clearTimeout(talkTimeoutRef.current);
    };
  }, []);

  function handleReset() {
    setMessages([]);
    setInput("");
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
      <div className="fixed top-0 inset-x-0 z-30 h-16 flex items-center justify-between bg-black px-6">
        <h2 className="text-xl font-bold text-white">
          💸株本赤音ちゃん💸
        </h2>
        <button
          type="button"
          onClick={handleReset}
          disabled={messages.length === 0 || isLoading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          × リセット
        </button>
      </div>

      <div
        className="flex-1 min-h-0 flex gap-6 py-2 pb-16 pt-16 relative bg-no-repeat bg-cover bg-center]"
        style={{ backgroundImage: "url(/background.png)" }}
      >
        {/* 画像分の横幅を確保するダミー要素（画像自体はabsoluteでフッターに重ねる） */}
        <div className="hidden lg:block w-48 shrink-0" />
        <img
          src={isTalking && talkFrame === 1 ? "/akane-chan-talk.png" : "/akane-chan.png"}
          alt="株本赤音ちゃん"
          className="hidden lg:block absolute left-5 top-[calc(4rem-5px)] h-[calc(100%-4rem)] w-auto object-contain z-50"
        />

        <div className="flex-1 min-h-0 rounded-xl flex flex-col overflow-hidden h-full relative">
          <img
            src={isTalking && talkFrame === 1 ? "/akane-chan-talk.png" : "/akane-chan.png"}
            alt="株本赤音ちゃん"
            className="lg:hidden absolute inset-0 w-full h-full object-cover object-top"
          />
          <div className="lg:hidden absolute inset-0 bg-white/50 " />
          <div className="relative z-10 flex-1 overflow-y-auto px-2 py-6 pb-24 space-y-4">
            {messages.length === 0 ? (
              <div className="text-gray-700 text-lg text-center py-12">
                　赤音ちゃんに、銘柄の売り時・買い時などを<br />質問してみよう！！　
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                      m.role === "user"
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : "bg-pink-700 text-white rounded-bl-sm"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="flex items-end gap-2 justify-start">
                <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-sm bg-pink-700 text-white flex items-center gap-1">
                  えっと
                  <span className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="lg:rounded-lg fixed lg:bottom-2 bottom-0  left-0 right-0 lg:left-[14rem] lg:right-2 z-10 bg-gray-400 border-t border-gray-300 dark:border-gray-700 p-3 flex items-start gap-2"
      >
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            maxLength={200}
            rows={1}
            placeholder="例: トヨタ自動車は今売り時ですか?"
            className="w-full resize-none break-words leading-5 overflow-y-auto pl-4 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-base lg:text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {input && (
            <button
              type="button"
              onClick={() => {
                setInput("");
                textareaRef.current?.focus();
              }}
              aria-label="入力をクリア"
              className="absolute right-4 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ×
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="shrink-0 px-5 py-2 border border-transparent bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          送信
        </button>
      </form>
    </div>
  );
}
