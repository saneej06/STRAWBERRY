import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, User } from "lucide-react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { formatCurrency } from "../utils/format";
import { getAuthToken } from "../services/api";

type ChatMessage = { role: "user" | "model"; text: string };
type SnapshotItem = { label: string; value: string; helper: string; tone: string; prompt: string };
type ScopePrompt = { title: string; prompt: string };
type AssistantLanguage = "english" | "tamil";

const SidebarPanel: React.FC<{
  title: string;
  children: React.ReactNode;
  isDark: boolean;
  elevated?: boolean;
}> = ({
  title,
  children,
  isDark,
  elevated,
}) => {
  return (
    <section
      className="rounded-[2rem] border p-5"
      style={{
        background: elevated
          ? isDark
            ? "linear-gradient(180deg, rgba(17,24,39,0.98) 0%, rgba(8,12,20,0.98) 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)"
          : "var(--bg-surface)",
        borderColor: "var(--border)",
        boxShadow: elevated ? undefined : isDark ? "0 22px 50px rgba(0,0,0,0.22)" : "0 18px 38px rgba(15,23,42,0.08)",
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
};

const SnapshotCard: React.FC<{ item: SnapshotItem; onClick: (prompt: string) => void; disabled: boolean }> = ({
  item,
  onClick,
  disabled,
}) => {
  return (
    <button
      type="button"
      onClick={() => onClick(item.prompt)}
      disabled={disabled}
      className="w-full rounded-2xl border px-4 py-4 text-left transition-all hover:-translate-y-0.5 disabled:opacity-60"
      style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: item.tone }}>
        {item.label}
      </p>
      <p className="mt-3 text-lg font-bold" style={{ color: "var(--text-primary)" }}>
        {item.value}
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        {item.helper}
      </p>
    </button>
  );
};

const ScopeItem: React.FC<{ item: ScopePrompt; isDark: boolean; onClick: (prompt: string) => void; disabled: boolean }> = ({
  item,
  isDark,
  onClick,
  disabled,
}) => {
  return (
    <button
      type="button"
      onClick={() => onClick(item.prompt)}
      disabled={disabled}
      className="flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 disabled:opacity-60"
      style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
    >
      <div
        className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-xl"
        style={{ background: isDark ? "rgba(34,211,238,0.14)" : "rgba(8,145,178,0.12)", color: "var(--accent)" }}
      >
        <Sparkles size={14} />
      </div>
      <p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
        {item.title}
      </p>
    </button>
  );
};

function renderInlineMarkdown(text: string) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return segments.map((segment, index) => {
    const boldMatch = segment.match(/^\*\*(.+)\*\*$/);
    if (boldMatch) {
      return (
        <strong key={`${segment}-${index}`} className="font-semibold" style={{ color: "var(--text-primary)" }}>
          {boldMatch[1]}
        </strong>
      );
    }

    return <React.Fragment key={`${segment}-${index}`}>{segment}</React.Fragment>;
  });
}

function renderModelMessage(text: string) {
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;

    blocks.push(
      <ul key={`list-${blocks.length}`} className="list-disc space-y-1.5 pl-5">
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    const listMatch = trimmed.match(/^[-*]\s+(.*)$/) || trimmed.match(/^\d+\.\s+(.*)$/);
    if (listMatch) {
      listItems.push(listMatch[1]);
      return;
    }

    flushList();

    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/) || trimmed.match(/^\*\*(.+)\*\*$/);
    if (headingMatch) {
      blocks.push(
        <p key={`heading-${index}`} className="pt-1 font-semibold" style={{ color: "var(--text-primary)" }}>
          {headingMatch[1]}
        </p>,
      );
      return;
    }

    blocks.push(
      <p key={`paragraph-${index}`} className="leading-relaxed">
        {renderInlineMarkdown(trimmed)}
      </p>,
    );
  });

  flushList();

  return <div className="space-y-2.5 text-sm">{blocks}</div>;
}

export default function AIAssistant() {
  const { expenses, debtors } = useData();
  const { currentUser } = useAuth();
  const { currency: preferredCurrency, theme } = useApp();
  const isDark = theme === "dark";
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      text: "Hello! I am your STRAWBERRY AI Assistant. I can help you analyze expenses, review debt positions, and turn your financial activity into clear next steps. What would you like to explore?",
    },
  ]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState<AssistantLanguage>("english");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const summary = useMemo(() => {
    const totalExpense = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalDebt = debtors.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalCollected = debtors.reduce((sum, item) => sum + (Number(item.paidAmount) || 0), 0);
    const remainingBalance = Math.max(0, totalDebt - totalCollected);
    const topCategoryEntries = Object.entries(
      expenses.reduce<Record<string, number>>((acc, item) => {
        const key = item.category || "Uncategorized";
        acc[key] = (acc[key] || 0) + (Number(item.amount) || 0);
        return acc;
      }, {}),
    ) as Array<[string, number]>;
    const topCategory = topCategoryEntries.sort((a, b) => b[1] - a[1])[0];
    const recoveryRate = totalDebt > 0 ? Math.round((totalCollected / totalDebt) * 100) : 0;

    return {
      totalExpense,
      totalDebt,
      totalCollected,
      remainingBalance,
      expenseCount: expenses.length,
      pendingCount: debtors.filter((d) => d.status === "pending").length,
      topCategory: topCategory ? topCategory[0] : "No category yet",
      recoveryRate,
    };
  }, [debtors, expenses]);

  const quickPrompts = useMemo(
    () => [
      "Summarize my current spending and debt position.",
      "Which expense category is costing me the most?",
      "How much outstanding debt is still unpaid?",
      "Give me one practical way to improve cash flow this month.",
    ],
    [],
  );
  const liveSnapshotItems = useMemo<SnapshotItem[]>(
    () => [
      {
        label: "Total Expenses",
        value: formatCurrency(summary.totalExpense, preferredCurrency),
        helper: `${summary.expenseCount} recorded entries`,
        tone: "#38bdf8",
        prompt: "Summarize my total expenses and explain what they say about my current spending.",
      },
      {
        label: "Outstanding Balance",
        value: formatCurrency(summary.remainingBalance, preferredCurrency),
        helper: `${summary.pendingCount} pending debtors`,
        tone: "#fb923c",
        prompt: "Analyze my outstanding balance and tell me what actions I should take on pending debtors.",
      },
      {
        label: "Top Category",
        value: summary.topCategory,
        helper: "Current highest concentration",
        tone: "#a855f7",
        prompt: `Explain why ${summary.topCategory} is currently my top expense category and what I should review.`,
      },
    ],
    [preferredCurrency, summary.expenseCount, summary.pendingCount, summary.remainingBalance, summary.topCategory, summary.totalExpense],
  );
  const assistantScopeItems = useMemo<ScopePrompt[]>(
    () => [
      {
        title: "Summarize your current expense and debt exposure",
        prompt: "Summarize my current expense and debt exposure in a clear financial overview.",
      },
      {
        title: "Break down category patterns and unusual spending",
        prompt: "Break down my expense category patterns and highlight any unusual spending.",
      },
      {
        title: "Explain receivables recovery opportunities",
        prompt: "Explain my receivables recovery opportunities based on outstanding debtors.",
      },
      {
        title: "Turn raw financial data into practical next actions",
        prompt: "Turn my current financial data into practical next actions I should take.",
      },
    ],
    [],
  );

  const buildSafeContext = () => {
    const totalExpense = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const expenseCount = expenses.length;

    const categoryTotals = expenses.reduce<Record<string, number>>((acc, item) => {
      const key = item.category || "Uncategorized";
      acc[key] = (acc[key] || 0) + (Number(item.amount) || 0);
      return acc;
    }, {});

    const debtorCount = debtors.length;
    const totalDebt = debtors.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalCollected = debtors.reduce((sum, item) => sum + (Number(item.paidAmount) || 0), 0);
    const pendingCount = debtors.filter((d) => d.status === "pending").length;

    return {
      expenseSummary: {
        totalExpense,
        expenseCount,
        categoryTotals,
      },
      debtorSummary: {
        debtorCount,
        totalDebt,
        totalCollected,
        pendingCount,
        remainingBalance: totalDebt - totalCollected,
      },
      preferredCurrency,
    };
  };
  const languageInstruction =
    language === "tamil"
      ? "Reply fully in Tamil. If you must mention English terms, keep the main explanation in Tamil."
      : "Reply in English.";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [loading, messages]);

  const submitMessage = async (rawMessage: string) => {
    const userMessage = rawMessage.trim();
    if (!userMessage || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setLoading(true);

    try {
      if (!currentUser) {
        throw new Error("You must be logged in to use the AI assistant.");
      }

      const safeContext = buildSafeContext();
      const accessToken = getAuthToken();
      if (!accessToken) throw new Error("Your session has expired. Please sign in again.");

      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: `${languageInstruction}\n\nUser request: ${userMessage}`,
          context: safeContext,
        }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("The AI backend is not available or returned an invalid response.");
      }

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.error || "Failed to connect to AI service.");
      }

      setMessages((prev) => [
        ...prev,
        { role: "model", text: responseData?.text || "I could not generate a response." },
      ]);
    } catch (error: any) {
      console.error("AI Error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "model", text: `Error: ${error.message || "Failed to connect to AI."}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessage(input);
  };

  return (
    <div
      className="space-y-6 animate-in fade-in duration-500"
      style={{
        background: isDark
          ? "radial-gradient(circle at top left, rgba(34,211,238,0.09), transparent 30%), radial-gradient(circle at top right, rgba(59,130,246,0.12), transparent 24%)"
          : "radial-gradient(circle at top left, rgba(14,165,233,0.09), transparent 30%), radial-gradient(circle at top right, rgba(37,99,235,0.08), transparent 24%)",
      }}
    >
      <section
        className="rounded-[2rem] border p-6 md:p-8"
        style={{
          background: isDark
            ? "linear-gradient(135deg, rgba(11,17,32,0.96) 0%, rgba(16,25,43,0.95) 50%, rgba(13,36,74,0.95) 100%)"
            : "linear-gradient(135deg, rgba(248,252,255,0.98) 0%, rgba(238,247,255,0.98) 45%, rgba(228,239,255,0.98) 100%)",
          borderColor: isDark ? "rgba(56,189,248,0.16)" : "rgba(14,165,233,0.15)",
          boxShadow: isDark ? "0 28px 60px rgba(2, 6, 23, 0.38)" : "0 24px 50px rgba(14, 30, 56, 0.08)",
        }}
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ borderColor: isDark ? "rgba(103,232,249,0.18)" : "rgba(14,165,233,0.18)", color: isDark ? "#67e8f9" : "#0369a1", background: isDark ? "rgba(8,47,73,0.28)" : "rgba(224,242,254,0.76)" }}>
              <Sparkles size={14} />
              STRAWBERRY Intelligence
            </div>
            <h1 className="mt-4 text-4xl md:text-5xl font-black tracking-tight" style={{ color: isDark ? "#f8fbff" : "#0f172a" }}>
              A modern finance copilot for expenses, debt, and recovery decisions.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6" style={{ color: isDark ? "rgba(203,213,225,0.88)" : "rgba(51,65,85,0.84)" }}>
              Ask for sharp summaries, category analysis, debt collection guidance, or clear next actions based on your live STRAWBERRY data.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_360px]">
        <section
          className="rounded-[2rem] border overflow-hidden"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            boxShadow: isDark ? "0 22px 50px rgba(0,0,0,0.25)" : "0 20px 44px rgba(15,23,42,0.08)",
          }}
        >
          <div
            className="border-b px-5 py-4 md:px-6"
            style={{
              borderColor: "var(--border)",
              background: isDark
                ? "linear-gradient(180deg, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.55) 100%)"
                : "linear-gradient(180deg, rgba(241,245,249,0.85) 0%, rgba(248,250,252,0.9) 100%)",
            }}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                  Conversation Workspace
                </p>
                <h2 className="mt-1 text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                  Ask STRAWBERRY anything about your financial records
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-full border p-1" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                  {[
                    { key: "english" as const, label: "EN" },
                    { key: "tamil" as const, label: "TA" },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setLanguage(option.key)}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={
                        language === option.key
                          ? { background: "var(--accent)", color: "#06131a" }
                          : { color: "var(--text-muted)" }
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: isDark ? "rgba(34,197,94,0.2)" : "rgba(22,163,74,0.2)", color: isDark ? "#86efac" : "#15803d", background: isDark ? "rgba(20,83,45,0.22)" : "rgba(220,252,231,0.86)" }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: isDark ? "#4ade80" : "#16a34a" }} />
                  Live context connected
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b px-5 py-4 md:px-6" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={loading}
                onClick={() => submitMessage(prompt)}
                className="rounded-full border px-3 py-2 text-xs font-medium transition-all hover:-translate-y-0.5 disabled:opacity-60"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--bg-surface)" }}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="h-[560px] overflow-y-auto px-5 py-5 md:px-6">
            <div className="space-y-5">
              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex max-w-[88%] gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl"
                      style={
                        msg.role === "user"
                          ? {
                              background: isDark ? "rgba(34,211,238,0.14)" : "rgba(8,145,178,0.12)",
                              color: "var(--accent)",
                            }
                          : {
                              background: isDark ? "rgba(59,130,246,0.14)" : "rgba(29,78,216,0.1)",
                              color: isDark ? "#93c5fd" : "#1d4ed8",
                            }
                      }
                    >
                      {msg.role === "user" ? <User size={18} /> : <Bot size={18} />}
                    </div>

                    <div
                      className={`rounded-[1.6rem] px-4 py-3.5 ${msg.role === "user" ? "rounded-tr-md" : "rounded-tl-md"}`}
                      style={
                        msg.role === "user"
                          ? {
                              background: isDark
                                ? "linear-gradient(180deg, rgba(10,35,47,0.88) 0%, rgba(8,28,36,0.96) 100%)"
                                : "linear-gradient(180deg, rgba(236,254,255,0.96) 0%, rgba(207,250,254,0.98) 100%)",
                              border: `1px solid ${isDark ? "rgba(34,211,238,0.12)" : "rgba(8,145,178,0.14)"}`,
                              color: "var(--text-primary)",
                            }
                          : {
                              background: isDark
                                ? "linear-gradient(180deg, rgba(24,24,34,0.96) 0%, rgba(18,18,26,0.98) 100%)"
                                : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
                              border: "1px solid var(--border)",
                              color: "var(--text-secondary)",
                              boxShadow: isDark ? "0 10px 24px rgba(0,0,0,0.18)" : "0 12px 24px rgba(15,23,42,0.05)",
                            }
                      }
                    >
                      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: msg.role === "user" ? "var(--accent)" : "var(--text-muted)" }}>
                        {msg.role === "user" ? "You" : "STRAWBERRY AI"}
                      </div>
                      {msg.role === "model" ? (
                        renderModelMessage(msg.text)
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex max-w-[88%] gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: isDark ? "rgba(59,130,246,0.14)" : "rgba(29,78,216,0.1)", color: isDark ? "#93c5fd" : "#1d4ed8" }}>
                      <Bot size={18} />
                    </div>
                    <div
                      className="rounded-[1.6rem] rounded-tl-md border px-4 py-3.5"
                      style={{
                        background: isDark
                          ? "linear-gradient(180deg, rgba(24,24,34,0.96) 0%, rgba(18,18,26,0.98) 100%)"
                          : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
                        borderColor: "var(--border)",
                        color: "var(--text-muted)",
                      }}
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <Loader2 size={16} className="animate-spin" />
                        Thinking through your data...
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t p-4 md:p-5" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
            <form onSubmit={handleSend} className="space-y-3">
              <div
                className="rounded-[1.6rem] border p-2"
                style={{
                  background: "var(--bg-surface)",
                  borderColor: "var(--border)",
                  boxShadow: isDark ? "inset 0 1px 0 rgba(255,255,255,0.02)" : "inset 0 1px 0 rgba(255,255,255,0.7)",
                }}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submitMessage(input);
                      }
                    }}
                    placeholder="Ask about spending behavior, overdue balances, category spikes, or debt recovery strategy..."
                    className="min-h-[96px] flex-1 resize-none rounded-[1.2rem] border px-4 py-3 text-sm outline-none"
                    style={{
                      background: isDark ? "rgba(15,23,42,0.4)" : "rgba(248,250,252,0.9)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] px-5 py-3 text-sm font-semibold text-black transition-all disabled:opacity-50 md:min-w-[156px]"
                    style={{
                      background: "linear-gradient(135deg, var(--accent) 0%, #67e8f9 100%)",
                      boxShadow: "0 14px 26px rgba(34,211,238,0.22)",
                    }}
                  >
                    {loading ? "Working..." : "Send Prompt"}
                    <Send size={16} />
                  </button>
                </div>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Press Enter to send. Use Shift + Enter for a new line. Current response language: {language === "tamil" ? "Tamil" : "English"}.
              </p>
            </form>
          </div>
        </section>

        <aside className="space-y-6">
          <SidebarPanel title="Live Snapshot" isDark={isDark}>
            {liveSnapshotItems.map((item) => (
              <SnapshotCard key={item.label} item={item} onClick={submitMessage} disabled={loading} />
            ))}
          </SidebarPanel>

          <SidebarPanel title="Assistant Scope" isDark={isDark} elevated>
            {assistantScopeItems.map((item) => (
              <ScopeItem key={item.title} item={item} isDark={isDark} onClick={submitMessage} disabled={loading} />
            ))}
          </SidebarPanel>
        </aside>
      </div>
    </div>
  );
}
