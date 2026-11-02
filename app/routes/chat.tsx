import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import type { Route } from "./+types/chat";
import { backendFetch } from "../utils/backend.server";
import { StockPriceChart } from "../components/StockPriceChart";

export function meta() {
  return [{ title: "株本茜ちゃん" }];
}

interface StockCandidate {
  code: string;
  name: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  candidates?: StockCandidate[];
  showChart?: boolean;
  chartCode?: string;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const message = String(formData.get("message") ?? "");
  const history: ChatMessage[] = JSON.parse(String(formData.get("history") ?? "[]"));
  const selectedStockRaw = formData.get("selectedStock");
  const selectedStock: StockCandidate | null = selectedStockRaw
    ? JSON.parse(String(selectedStockRaw))
    : null;

  const res = await backendFetch("/api/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history: history.map(({ role, content }) => ({ role, content })),
      selected_stock: selectedStock,
    }),
  });

  if (!res.ok) {
    return { reply: "エラーが発生しました。しばらくしてから再度お試しください。" };
  }

  const data: {
    reply: string;
    candidates?: StockCandidate[];
    selected_stock?: StockCandidate;
    show_chart?: boolean;
  } = await res.json();
  return {
    reply: data.reply,
    candidates: data.candidates,
    selectedStock: data.selected_stock,
    showChart: data.show_chart ?? false,
  };
}

const TALK_SWAP_INTERVAL_MS = 500;
const MAX_TEXTAREA_LINES = 5;
// この時間だけ新しい音声認識結果が来なければ「話し終わった」とみなして自動送信する
const SILENCE_AUTO_SEND_MS = 2000;

// Web Speech API はブラウザ標準の型定義に含まれていないため、使う分だけ最小限に型を定義する。
interface SpeechRecognitionResultEvent extends Event {
  resultIndex: number;
  results: {
    [index: number]: { [index: number]: { transcript: string }; isFinal: boolean };
    length: number;
  };
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

export default function Chat() {
  const fetcher = useFetcher<typeof action>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockCandidate | null>(null);
  const [input, setInput] = useState("");
  const [isTalking, setIsTalking] = useState(false);
  const [talkFrame, setTalkFrame] = useState<0 | 1>(0);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const talkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const talkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef("");
  const baseTextRef = useRef("");
  const hasAutoSubmittedRef = useRef(false);
  const isListeningRef = useRef(false);
  // 音声認識のイベントハンドラはマウント時に一度だけ登録するため、常に最新の
  // submitMessage を呼べるようrefで参照を持っておく（古いinput/isLoadingを
  // 掴んだままのクロージャにならないようにするため）。
  const submitMessageRef = useRef<(overrideText?: string, sendText?: string) => void>(() => {});

  const isLoading = fetcher.state !== "idle";

  function stopListening() {
    if (!isListeningRef.current) return;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    isListeningRef.current = false;
    setIsListening(false);
    recognitionRef.current?.stop();
  }

  function submitMessage(overrideText?: string, sendText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    if (isListeningRef.current) stopListening();

    const historyForRequest = messages;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    if (overrideText === undefined) setInput("");

    fetcher.submit(
      {
        message: (sendText ?? text).trim(),
        history: JSON.stringify(historyForRequest),
        ...(selectedStock ? { selectedStock: JSON.stringify(selectedStock) } : {}),
      },
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
        return [
          ...prev,
          {
            role: "assistant",
            content: fetcher.data!.reply,
            candidates: fetcher.data!.candidates,
            showChart: fetcher.data!.showChart,
            chartCode: fetcher.data!.selectedStock?.code,
          },
        ];
      });
      // 銘柄が新たに確定した（または切り替わった）レスポンスでのみ selectedStock が
      // 返ってくるので、その場合だけキャッシュを更新する。
      if (fetcher.data.selectedStock) {
        setSelectedStock(fetcher.data.selectedStock);
      }
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

  // submitMessageRefを常に最新の submitMessage に同期させる（毎レンダー実行、代入だけなので軽量）。
  useEffect(() => {
    submitMessageRef.current = submitMessage;
  });

  // ブラウザのWeb Speech APIでマイク音声入力を扱う（未対応ブラウザではボタン自体を出さない）。
  // continuous + interimResultsで聞き続け、新しい認識結果が SILENCE_AUTO_SEND_MS の間
  // 来なければ「話し終わった」とみなして自動送信する。
  useEffect(() => {
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .webkitSpeechRecognition;
    if (!Ctor) return;

    setSpeechSupported(true);
    const recognition = new Ctor();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      if (hasAutoSubmittedRef.current) return;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setInput(`${baseTextRef.current}${finalTranscriptRef.current}${interim}`);

      silenceTimerRef.current = setTimeout(() => {
        hasAutoSubmittedRef.current = true;
        isListeningRef.current = false;
        setIsListening(false);
        recognition.stop();

        const text = `${baseTextRef.current}${finalTranscriptRef.current}`.trim();
        if (text) {
          submitMessageRef.current(text);
          setInput("");
        }
      }, SILENCE_AUTO_SEND_MS);
    };
    recognition.onend = () => {
      isListeningRef.current = false;
      setIsListening(false);
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
    recognition.onerror = () => {
      isListeningRef.current = false;
      setIsListening(false);
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
    recognitionRef.current = recognition;

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.stop();
    };
  }, []);

  function toggleListening() {
    const recognition = recognitionRef.current;
    if (!recognition || isLoading) return;
    if (isListeningRef.current) {
      stopListening();
    } else {
      baseTextRef.current = input;
      finalTranscriptRef.current = "";
      hasAutoSubmittedRef.current = false;
      isListeningRef.current = true;
      setIsListening(true);
      recognition.start();
    }
  }

  function handleReset() {
    setMessages([]);
    setInput("");
    setSelectedStock(null);
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
      <div className="fixed top-0 inset-x-0 z-30 h-16 flex items-center justify-between gap-2 bg-black px-6">
        <h2 className="text-xl font-bold text-white shrink-0">
          💸株本茜ちゃん💸
        </h2>
        {selectedStock && (
          <div className="flex items-center gap-1 min-w-0 px-3 py-1.5 rounded-full bg-pink-700 text-white text-xs font-medium">
            <span className="truncate">{selectedStock.name}（{selectedStock.code}）</span>
          </div>
        )}
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
          alt="株本茜ちゃん"
          className="hidden lg:block absolute left-5 top-[calc(4rem-5px)] h-[calc(100%-4rem)] w-auto object-contain z-50"
        />

        <div className="flex-1 min-h-0 rounded-xl flex flex-col overflow-hidden h-full relative">
          <img
            src={isTalking && talkFrame === 1 ? "/akane-chan-talk.png" : "/akane-chan.png"}
            alt="株本茜ちゃん"
            className="lg:hidden absolute inset-0 w-full h-full object-cover object-top"
          />
          <div className="lg:hidden absolute inset-0 bg-white/50 " />
          <div className="relative z-10 flex-1 overflow-y-auto px-2 py-6 pb-24 space-y-4">
            {messages.length === 0 ? (
              <div className="text-gray-700 text-lg text-center py-12">
                　茜ちゃんに、銘柄の売り時・買い時などを<br />質問してみよう！！　
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i}>
                  <div
                    className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`flex flex-col gap-2 ${m.role === "user" ? "max-w-[80%]" : "max-w-[95%]"}`}>
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                          m.role === "user"
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : "bg-pink-700 text-white rounded-bl-sm"
                        }`}
                      >
                        {m.content}
                      </div>
                      {m.candidates && m.candidates.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {m.candidates.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => submitMessage(`${c.name}（${c.code}）`, c.code)}
                              disabled={isLoading}
                              className="px-3 py-1.5 rounded-full border border-pink-700 dark:border-pink-400 text-pink-700 dark:text-pink-300 bg-white dark:bg-gray-800 text-xs font-medium hover:bg-pink-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {c.name}（{c.code}）
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {m.showChart && m.chartCode && (
                    <div className="mt-1 w-[95%] bg-white dark:bg-gray-800 rounded-xl p-2 border border-gray-200 dark:border-gray-700">
                      <StockPriceChart initialCode={m.chartCode} priceHeight={200} volumeHeight={80} />
                    </div>
                  )}
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

      {isListening && (
        <div className="fixed lg:bottom-[4.75rem] bottom-[3.75rem] left-0 right-0 lg:left-[14rem] lg:right-2 z-10 flex justify-center pointer-events-none">
          <span className="px-3 py-1 rounded-full bg-red-600/90 text-white text-xs shadow">
            🎤 聞いています…（2秒話が止まると自動で送信します）
          </span>
        </div>
      )}

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
            placeholder="例: トヨタ自動車は今買い時ですか？"
            className="w-full resize-none break-words leading-5 overflow-y-auto pl-4 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-base lg:text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 placeholder:text-sm lg:placeholder:text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        {speechSupported && (
          <button
            type="button"
            onClick={toggleListening}
            disabled={isLoading}
            aria-label={isListening ? "音声入力を停止" : "音声入力を開始"}
            aria-pressed={isListening}
            className={`shrink-0 p-2.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isListening
                ? "bg-red-600 border-transparent text-white animate-pulse"
                : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
              <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7 7 0 0 0 19 11Z" />
            </svg>
          </button>
        )}
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
