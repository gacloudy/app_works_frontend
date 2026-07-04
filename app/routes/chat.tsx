import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import type { Route } from "./+types/chat";
import { backendFetch } from "../utils/backend.server";

export function meta() {
  return [{ title: "チャット | 株価分析" }];
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

export default function Chat() {
  const fetcher = useFetcher<typeof action>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const isLoading = fetcher.state !== "idle";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

  function handleReset() {
    setMessages([]);
    setInput("");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          チャット
        </h2>
        <button
          type="button"
          onClick={handleReset}
          disabled={messages.length === 0 || isLoading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          会話をリセット
        </button>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="text-gray-400 dark:text-gray-500 text-sm text-center py-12">
              銘柄の売り時・買い時などを質問してみましょう
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-lg px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-lg px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500">
                入力中...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-gray-200 dark:border-gray-700 p-3 flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={200}
            placeholder="例: トヨタ自動車は今売り時ですか?"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            送信
          </button>
        </form>
      </div>
    </div>
  );
}
