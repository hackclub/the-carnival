import { useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SendHorizonal, X, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type HackClubAIResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: "assistant"; content: string };
    finish_reason: string | null;
  }>;
};

const systemPrompt = `You are Genie, a friendly, concise helper for the YSWS Carnival.
Context about the event:
- Theme: 🎪 Build an extension, plugin, or widget — add your ride to the midway!
- Requirements: Original idea (not a trivial remix), open-source, works properly, 5+ users, clear build/run instructions.
- Community: Join #the-carnival on Hack Club Slack for questions and vibes.
- Rewards: Tools, hardware, infra credits that help your dev journey.
- Deadline: 30 September 2025.
Tone: encouraging, practical, and carnival-themed (sparingly). Keep answers crisp; include quick next steps when helpful.
`;

function stripThink(content: string): string {
  try {
    return content.replace(/<think>[\s\S]*?<\/think>\n?/g, "").trim();
  } catch {
    return content;
  }
}

export default function GenieChat({ isOpen, onClose, headerIconSrc }: { isOpen: boolean; onClose: () => void; headerIconSrc?: string; }) {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: "assistant",
    content: "Hey! I’m Genie. What are you building for the Carnival? I can help brainstorm features, validate scope, or draft your README. 🎟️"
  }]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const trimmedHistory = useMemo(() => {
    const history = messages.slice(-10); // keep it light
    return history;
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const question = input.trim();
    if (!question || isSending) return;
    setInput("");

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setIsSending(true);

    try {
      const payload = {
        messages: [
          { role: "system", content: systemPrompt },
          ...trimmedHistory.filter(m => m.role !== "system"),
          { role: "user", content: question }
        ]
      };

      const res = await fetch("https://ai.hackclub.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const data: HackClubAIResponse = await res.json();
      const raw = data?.choices?.[0]?.message?.content ?? "Sorry, I didn’t catch that.";
      const content = stripThink(raw);

      setMessages(prev => [...prev, { role: "assistant", content }]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Hmm, the midway’s generator flickered. Please try again in a moment." }
      ]);
    } finally {
      setIsSending(false);
      queueMicrotask(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }, [input, isSending, messages, trimmedHistory]);

  const quickPrompts = [
    "🎪 Brainstorm carnival ride features",
    "📜 Help me write a README template",
    "🎟️ How to get 5 users quickly?",
    "🛠️ Draft build/run instructions",
    "🎨 What makes a great extension?",
    "🚀 Ideas for my midway attraction"
  ];

  return (
    <>
      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/20 backdrop-blur-[2px]"
            onClick={onClose}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="relative w-full md:w-[28rem] lg:w-[32rem] mx-auto md:rounded-3xl bg-white/90 backdrop-blur-md ring-1 ring-amber-200 shadow-xl md:mb-0 mb-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-4 border-b border-amber-200/70 bg-gradient-to-b from-amber-50/80 to-transparent md:rounded-t-3xl">
                <div className="flex items-center gap-2">
                  {headerIconSrc ? (
                    <img src={headerIconSrc} alt="Genie" className="w-8 h-8 rounded-full ring-2 ring-amber-300" />
                  ) : (
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-white ring-2 ring-amber-300" />
                  )}
                  <div className="text-amber-900 font-semibold">Genie</div>
                </div>
                <button
                  className="p-2 rounded-full hover:bg-amber-100 text-amber-800"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto p-4 space-y-3 relative">
                {/* Carnival bunting decoration */}
                <div className="pointer-events-none absolute top-0 left-0 right-0 flex justify-between px-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-0 h-0 border-l-3 border-r-3 border-l-transparent border-r-transparent opacity-30"
                      style={{
                        borderBottom: `8px solid ${["#f43f5e","#fb923c","#f59e0b","#22c55e","#3b82f6","#a855f7"][i % 6]}`
                      }}
                    />
                  ))}
                </div>

                {messages.map((m, idx) => (
                  <motion.div 
                    key={idx} 
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={
                        m.role === "user"
                          ? "max-w-[85%] rounded-2xl px-3 py-2 text-white shadow-lg whitespace-pre-wrap break-words overflow-hidden relative"
                          : "max-w-[85%] rounded-2xl px-3 py-2 shadow-lg whitespace-pre-wrap break-words overflow-hidden relative ring-1"
                      }
                      style={
                        m.role === "user"
                          ? {
                              background: "linear-gradient(135deg, #f59e0b, #f97316)",
                              boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)"
                            }
                          : {
                              background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                              color: "#92400e",
                              borderColor: "#f59e0b50",
                              boxShadow: "0 4px 12px rgba(245, 158, 11, 0.15)"
                            }
                      }
                    >
                      {m.role === "assistant" ? (
                        <ReactMarkdown
                          components={{
                            a: ({ node, ...props }) => (
                              <a {...props} className="break-words underline text-amber-700 hover:text-amber-800" target="_blank" rel="noreferrer" />
                            ),
                            p: ({ node, ...props }) => (
                              <p {...props} className="whitespace-pre-wrap break-words leading-relaxed" />
                            ),
                            li: ({ node, ...props }) => (
                              <li {...props} className="whitespace-pre-wrap break-words" />
                            ),
                            pre: ({ node, ...props }) => (
                              <pre {...props} className="overflow-x-auto max-w-full bg-amber-100/60 rounded-lg p-3 ring-1 ring-amber-200" />
                            ),
                            code: (props: any) => {
                              const { inline, ...rest } = props || {};
                              return inline ? (
                                <code {...rest} className="whitespace-pre-wrap break-words bg-amber-100/60 rounded px-1 py-0.5" />
                              ) : (
                                <code {...rest} className="whitespace-pre break-words" />
                              );
                            },
                            img: ({ node, ...props }) => (
                              <img {...props} className="max-w-full h-auto rounded" />
                            ),
                            table: ({ node, ...props }) => (
                              <div className="overflow-x-auto max-w-full">
                                <table {...props} className="min-w-full" />
                              </div>
                            )
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      ) : (
                        m.content
                      )}
                    </div>
                  </motion.div>
                ))}

                {!isSending && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {quickPrompts.map((q, i) => (
                      <motion.button
                        key={q}
                        onClick={() => setInput(q)}
                        whileHover={{ scale: 1.05, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        className="text-xs rounded-full px-3 py-1 ring-1 text-amber-800 hover:shadow-md transition-all"
                        style={{
                          background: `linear-gradient(135deg, ${["#fef3c7", "#fed7aa", "#fde68a", "#fbcfe8", "#ddd6fe", "#d1fae5"][i % 6]}, white)`,
                          borderColor: "#f59e0b50"
                        }}
                      >
                        {q}
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-amber-200/70 md:rounded-b-3xl relative overflow-hidden"
                   style={{
                     background: "linear-gradient(135deg, #fef3c7, #fde68a)"
                   }}>
                {/* Subtle carnival lights effect */}
                <div className="pointer-events-none absolute top-0 left-0 right-0 h-1 flex">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 0.8, 0.3] }}
                      transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
                      className="flex-1 h-full"
                      style={{ backgroundColor: ["#f43f5e", "#fb923c", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"][i % 6] }}
                    />
                  ))}
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="🎪 Ask Genie about your carnival ride…"
                    className="flex-1 rounded-xl border border-amber-300/50 px-3 py-2 text-amber-900 placeholder-amber-700/70 bg-white/90 backdrop-blur focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 shadow-sm"
                  />
                  <motion.button
                    onClick={sendMessage}
                    disabled={isSending}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-white ring-1 ring-amber-500/60 disabled:opacity-50 shadow-lg"
                    style={{
                      background: isSending 
                        ? "linear-gradient(135deg, #9ca3af, #6b7280)"
                        : "linear-gradient(135deg, #f59e0b, #f97316)",
                      boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)"
                    }}
                  >
                    {isSending ? <Loader2 className="animate-spin" size={18} /> : <SendHorizonal size={18} />}
                  </motion.button>
                </div>
                <div className="mt-1 text-[10px] text-amber-800/90 font-medium">
                  🚩 Powered by Hack Club AI • Keep it original, open-source, and carnival-worthy! 🎟️
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}


