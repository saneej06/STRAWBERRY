import React, { useMemo, useState } from "react";
import {
  addDays,
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfDay,
  endOfMonth,
  format,
  isAfter,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  subDays,
  subQuarters,
} from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays, Download, Mail, TrendingDown, TrendingUp } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useData } from "../context/DataContext";
import { useApp } from "../context/AppContext";
import { formatCurrency } from "../utils/format";

type RangeKey = "this_month" | "last_30_days" | "this_quarter" | "last_quarter" | "custom";
type Tone = "success" | "warning" | "danger" | "neutral";

interface RangeMeta {
  start: Date;
  end: Date;
  titleLabel: string;
  selectLabel: string;
}

interface AgingBucket {
  label: string;
  amount: number;
  color: string;
}

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "this_month", label: "This Month" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "last_quarter", label: "Last Quarter" },
  { value: "custom", label: "Custom Range" },
];

const CATEGORY_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function parseRecordDate(value?: string, fallback?: any) {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (fallback?.toDate) {
    const parsed = fallback.toDate();
    if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function getQuarterLabel(date: Date) {
  return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
}

function formatRangeLabel(start: Date, end: Date) {
  return `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`;
}

function getPresetRange(rangeKey: Exclude<RangeKey, "custom">, referenceDate: Date): RangeMeta {
  const today = startOfDay(referenceDate);

  switch (rangeKey) {
    case "this_month": {
      const start = startOfMonth(today);
      return {
        start,
        end: today,
        titleLabel: format(today, "MMMM yyyy"),
        selectLabel: formatRangeLabel(start, today),
      };
    }
    case "last_30_days": {
      const start = subDays(today, 29);
      return {
        start,
        end: today,
        titleLabel: "Last 30 Days",
        selectLabel: formatRangeLabel(start, today),
      };
    }
    case "last_quarter": {
      const start = startOfQuarter(subQuarters(today, 1));
      const end = endOfDay(addDays(startOfQuarter(today), -1));
      return {
        start,
        end,
        titleLabel: getQuarterLabel(start),
        selectLabel: formatRangeLabel(start, end),
      };
    }
    case "this_quarter":
    default: {
      const start = startOfQuarter(today);
      return {
        start,
        end: today,
        titleLabel: getQuarterLabel(today),
        selectLabel: formatRangeLabel(start, today),
      };
    }
  }
}

function getToneStyles(tone: Tone) {
  switch (tone) {
    case "success":
      return { background: "rgba(34, 197, 94, 0.12)", color: "#16a34a" };
    case "warning":
      return { background: "rgba(245, 158, 11, 0.16)", color: "#d97706" };
    case "danger":
      return { background: "rgba(239, 68, 68, 0.12)", color: "#dc2626" };
    case "neutral":
    default:
      return { background: "var(--bg-elevated)", color: "var(--text-muted)" };
  }
}

function getRemainingAmount(amount: number, paidAmount: number) {
  return Math.max(0, Number(amount || 0) - Number(paidAmount || 0));
}

function buildDelta(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) {
      return { value: 0, text: "No change vs last period", isUp: false };
    }

    return { value: 100, text: "New compared with last period", isUp: true };
  }

  const delta = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(delta),
    text: `${Math.abs(delta).toFixed(1)}% vs last period`,
    isUp: delta >= 0,
  };
}

export default function Reports() {
  const { expenses, debtors, payments } = useData();
  const { currency: preferredCurrency, theme } = useApp();
  const isDark = theme === "dark";
  const today = startOfDay(new Date());
  const initialRange = getPresetRange("this_quarter", today);

  const [rangeKey, setRangeKey] = useState<RangeKey>("this_quarter");
  const [customStartDate, setCustomStartDate] = useState(format(initialRange.start, "yyyy-MM-dd"));
  const [customEndDate, setCustomEndDate] = useState(format(initialRange.end, "yyyy-MM-dd"));

  const rangeMeta = useMemo(() => {
    if (rangeKey !== "custom") {
      return getPresetRange(rangeKey, today);
    }

    const parsedStart = parseRecordDate(customStartDate) || initialRange.start;
    const parsedEnd = parseRecordDate(customEndDate) || initialRange.end;
    const safeStart = isAfter(parsedStart, parsedEnd) ? parsedEnd : parsedStart;
    const safeEnd = isAfter(parsedStart, parsedEnd) ? parsedStart : parsedEnd;

    return {
      start: safeStart,
      end: safeEnd,
      titleLabel: "Custom Range",
      selectLabel: formatRangeLabel(safeStart, safeEnd),
    };
  }, [customEndDate, customStartDate, initialRange.end, initialRange.start, rangeKey, today]);

  const handleRangeChange = (nextValue: RangeKey) => {
    if (nextValue === "custom") {
      setCustomStartDate(format(rangeMeta.start, "yyyy-MM-dd"));
      setCustomEndDate(format(rangeMeta.end, "yyyy-MM-dd"));
    }

    setRangeKey(nextValue);
  };

  const reportData = useMemo(() => {
    const start = startOfDay(rangeMeta.start);
    const end = endOfDay(rangeMeta.end);
    const periodDays = differenceInCalendarDays(end, start) + 1;
    const previousStart = startOfDay(subDays(start, periodDays));
    const previousEnd = endOfDay(subDays(start, 1));
    const referenceDate = new Date(Math.min(today.getTime(), end.getTime()));

    const isWithinRange = (date: Date | null, from: Date, to: Date) =>
      Boolean(date) && !isAfter(from, date as Date) && !isAfter(date as Date, to);

    const expensesInRange = expenses.filter((expense) =>
      isWithinRange(parseRecordDate(expense.date, expense.createdAt), start, end),
    );

    const previousExpenses = expenses.filter((expense) =>
      isWithinRange(parseRecordDate(expense.date, expense.createdAt), previousStart, previousEnd),
    );

    const paymentsInRange = payments.filter((payment) =>
      isWithinRange(parseRecordDate(payment.date, payment.createdAt), start, end),
    );

    const outstandingAsOf = (snapshotDate: Date) =>
      debtors.filter((debtor) => {
        const openedAt = parseRecordDate(undefined, debtor.createdAt) || parseRecordDate(debtor.date);
        return Boolean(openedAt) && !isAfter(openedAt as Date, snapshotDate) && getRemainingAmount(debtor.amount, debtor.paidAmount) > 0;
      });

    const outstandingDebtors = outstandingAsOf(referenceDate);
    const previousOutstandingDebtors = outstandingAsOf(previousEnd);

    const totalSpent = expensesInRange.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const previousTotalSpent = previousExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const totalOutstanding = outstandingDebtors.reduce(
      (sum, debtor) => sum + getRemainingAmount(debtor.amount, debtor.paidAmount),
      0,
    );
    const previousOutstanding = previousOutstandingDebtors.reduce(
      (sum, debtor) => sum + getRemainingAmount(debtor.amount, debtor.paidAmount),
      0,
    );

    const agingReport = [
      { label: "Current", amount: 0, color: "#3b82f6" },
      { label: "1-30 Days", amount: 0, color: "#7dd3fc" },
      { label: "31-60 Days", amount: 0, color: "#f59e0b" },
      { label: "61-90 Days", amount: 0, color: "#ef4444" },
      { label: "> 90 Days", amount: 0, color: "#b91c1c" },
    ] satisfies AgingBucket[];

    const getDebtorStatus = (debtor: (typeof outstandingDebtors)[number]) => {
      const dueDate = parseRecordDate(debtor.date, debtor.createdAt);
      if (!dueDate) {
        return { label: "Current", tone: "neutral" as Tone };
      }

      const dayDiff = differenceInCalendarDays(referenceDate, startOfDay(dueDate));

      if (dayDiff > 0) {
        return {
          label: `Overdue (${dayDiff} day${dayDiff === 1 ? "" : "s"})`,
          tone: "danger" as Tone,
        };
      }

      if (dayDiff === 0) {
        return { label: "Due Today", tone: "warning" as Tone };
      }

      if (dayDiff >= -7) {
        const dueSoon = Math.abs(dayDiff);
        return {
          label: `Due Soon (${dueSoon} day${dueSoon === 1 ? "" : "s"})`,
          tone: "warning" as Tone,
        };
      }

      return { label: "Current", tone: "neutral" as Tone };
    };

    outstandingDebtors.forEach((debtor) => {
      const dueDate = parseRecordDate(debtor.date, debtor.createdAt) || referenceDate;
      const age = differenceInCalendarDays(referenceDate, startOfDay(dueDate));
      const amount = getRemainingAmount(debtor.amount, debtor.paidAmount);

      if (age <= 0) agingReport[0].amount += amount;
      else if (age <= 30) agingReport[1].amount += amount;
      else if (age <= 60) agingReport[2].amount += amount;
      else if (age <= 90) agingReport[3].amount += amount;
      else agingReport[4].amount += amount;
    });

    const topDebtors = outstandingDebtors
      .map((debtor) => ({
        debtor,
        remaining: getRemainingAmount(debtor.amount, debtor.paidAmount),
        status: getDebtorStatus(debtor),
      }))
      .sort((a, b) => b.remaining - a.remaining)
      .slice(0, 5);

    const categoryTotals = expensesInRange.reduce<Record<string, number>>((acc, expense) => {
      const key = expense.category || "Uncategorized";
      acc[key] = (acc[key] || 0) + Number(expense.amount || 0);
      return acc;
    }, {});

    const categoryEntries = Object.entries(categoryTotals) as Array<[string, number]>;
    categoryEntries.sort((a, b) => b[1] - a[1]);
    const pieEntries = categoryEntries.slice(0, 5).map(([name, value], index) => ({
      name,
      value,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }));

    if (categoryEntries.length > 5) {
      const otherValue = categoryEntries.slice(5).reduce((sum, [, value]) => sum + Number(value), 0);
      pieEntries.push({ name: "Other", value: otherValue, color: CATEGORY_COLORS[5] });
    }

    const monthSeries = eachMonthOfInterval({
      start: startOfMonth(start),
      end: endOfMonth(end),
    }).map((monthStart) => {
      const monthEnd = endOfMonth(monthStart);
      const actual = expenses.reduce((sum, expense) => {
        const date = parseRecordDate(expense.date, expense.createdAt);
        if (!date || isAfter(monthStart, date) || isAfter(date, monthEnd)) {
          return sum;
        }
        return sum + Number(expense.amount || 0);
      }, 0);

      return { month: format(monthStart, "MMM"), actual };
    });

    const monthCount = Math.max(monthSeries.length, 1);
    const budgetBaseline =
      previousTotalSpent > 0 ? previousTotalSpent / monthCount : totalSpent > 0 ? totalSpent / monthCount : 0;
    const budgetSeries = monthSeries.map((item) => ({ ...item, budget: budgetBaseline }));

    const ledgerRows = [
      ...expensesInRange.map((expense) => {
        const recordDate = parseRecordDate(expense.date, expense.createdAt);
        return {
          id: `expense-${expense.id}`,
          date: recordDate || start,
          type: "Expense",
          description: expense.subject || expense.description || expense.merchant || "Expense entry",
          category: expense.category || "Uncategorized",
          amount: -Math.abs(Number(expense.amount || 0)),
          status: recordDate && isAfter(recordDate, today)
            ? { label: "Scheduled", tone: "warning" as Tone }
            : { label: "Paid", tone: "success" as Tone },
        };
      }),
      ...paymentsInRange.map((payment) => ({
        id: `payment-${payment.id}`,
        date: parseRecordDate(payment.date, payment.createdAt) || start,
        type: "Payment Received",
        description: `Payment from ${payment.debtorName}`,
        category: "Debt",
        amount: Math.abs(Number(payment.amount || 0)),
        status: { label: "Cleared", tone: "success" as Tone },
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      start,
      end,
      referenceDate,
      totalSpent,
      totalOutstanding,
      expenseDelta: buildDelta(totalSpent, previousTotalSpent),
      outstandingDelta: buildDelta(totalOutstanding, previousOutstanding),
      agingReport,
      topDebtors,
      pieEntries,
      budgetSeries,
      ledgerRows,
      highestCategory: pieEntries[0] || null,
    };
  }, [debtors, expenses, payments, rangeMeta.end, rangeMeta.start, today]);

  const reportTitle = `Debt & Expense Report - ${rangeMeta.titleLabel}`;
  const periodLabel = formatRangeLabel(reportData.start, reportData.end);
  const axisColor = isDark ? "#9ca3af" : "#64748b";
  const gridColor = isDark ? "rgba(148,163,184,0.14)" : "#e2e8f0";
  const tooltipStyle = {
    backgroundColor: isDark ? "#111827" : "#ffffff",
    border: `1px solid ${isDark ? "#374151" : "#d1d5db"}`,
    borderRadius: "12px",
    color: isDark ? "#f3f4f6" : "#0f172a",
  };

  const generateReportText = () => {
    const topDebtorLines =
      reportData.topDebtors.length > 0
        ? reportData.topDebtors
            .map(
              ({ debtor, remaining, status }) =>
                `- ${debtor.debtorName}: ${formatCurrency(remaining, preferredCurrency)} (${status.label})`,
            )
            .join("\n")
        : "- No outstanding debtors in this period";

    const categoryLines =
      reportData.pieEntries.length > 0
        ? reportData.pieEntries
            .map((entry) => `- ${entry.name}: ${formatCurrency(entry.value, preferredCurrency)}`)
            .join("\n")
        : "- No expense categories in this period";

    const ledgerLines =
      reportData.ledgerRows.length > 0
        ? reportData.ledgerRows
            .slice(0, 12)
            .map(
              (row) =>
                `- ${format(row.date, "yyyy-MM-dd")} | ${row.type} | ${row.description} | ${row.category} | ${
                  row.amount >= 0 ? "+" : "-"
                }${formatCurrency(Math.abs(row.amount), preferredCurrency)} | ${row.status.label}`,
            )
            .join("\n")
        : "- No transactions in this period";

    return [
      reportTitle,
      `Period: ${periodLabel}`,
      "",
      `Total Outstanding: ${formatCurrency(reportData.totalOutstanding, preferredCurrency)} (${reportData.outstandingDelta.text})`,
      `Total Spent: ${formatCurrency(reportData.totalSpent, preferredCurrency)} (${reportData.expenseDelta.text})`,
      "",
      "Top Debtors:",
      topDebtorLines,
      "",
      "Expense Categories:",
      categoryLines,
      "",
      "Transaction Ledger:",
      ledgerLines,
      "",
      "Generated by STRAWBERRY",
    ].join("\n");
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(reportTitle);
    const body = encodeURIComponent(generateReportText());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 18;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 30, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(reportTitle, 14, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(191, 219, 254);
    doc.text(periodLabel, pageWidth - 14, 18, { align: "right" });

    yPos = 42;
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(14, yPos, 86, 22, 4, 4, "F");
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    doc.text("TOTAL OUTSTANDING", 18, yPos + 7);
    doc.setTextColor(30, 64, 175);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(formatCurrency(reportData.totalOutstanding, preferredCurrency), 18, yPos + 16);

    doc.setFillColor(240, 253, 244);
    doc.roundedRect(110, yPos, 86, 22, 4, 4, "F");
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("TOTAL SPENT", 114, yPos + 7);
    doc.setTextColor(22, 163, 74);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(formatCurrency(reportData.totalSpent, preferredCurrency), 114, yPos + 16);

    yPos += 32;
    const topDebtorRows =
      reportData.topDebtors.length > 0
        ? reportData.topDebtors.map(({ debtor, remaining, status }) => [
            debtor.debtorName,
            formatCurrency(remaining, preferredCurrency),
            status.label,
          ])
        : [["No outstanding debtors", "", ""]];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Top Debtors", 14, yPos);
    autoTable(doc, {
      startY: yPos + 4,
      head: [["Debtor", "Outstanding", "Status"]],
      body: topDebtorRows,
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
    const categoryRows =
      reportData.pieEntries.length > 0
        ? reportData.pieEntries.map((entry) => [entry.name, formatCurrency(entry.value, preferredCurrency)])
        : [["No expense categories", ""]];

    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Expense Categories", 14, yPos);
    autoTable(doc, {
      startY: yPos + 4,
      head: [["Category", "Amount"]],
      body: categoryRows,
      headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
    const ledgerRows =
      reportData.ledgerRows.length > 0
        ? reportData.ledgerRows.slice(0, 20).map((row) => [
            format(row.date, "yyyy-MM-dd"),
            row.type,
            row.description,
            row.category,
            `${row.amount >= 0 ? "+" : "-"}${formatCurrency(Math.abs(row.amount), preferredCurrency)}`,
            row.status.label,
          ])
        : [["No transactions", "", "", "", "", ""]];

    if (yPos > 210) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Transaction Ledger", 14, yPos);
    autoTable(doc, {
      startY: yPos + 4,
      head: [["Date", "Type", "Description", "Category", "Amount", "Status"]],
      body: ledgerRows,
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8 },
      columnStyles: { 4: { halign: "right" } },
    });

    doc.save(`strawberry-report-${format(reportData.start, "yyyy-MM-dd")}-to-${format(reportData.end, "yyyy-MM-dd")}.pdf`);
  };

  const headerCardStyle: React.CSSProperties = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
  };

  const panelStyle: React.CSSProperties = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
  };

  const mutedTextStyle: React.CSSProperties = {
    color: "var(--text-muted)",
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-black" style={{ color: "var(--text-primary)" }}>
            {reportTitle}
          </h1>
          <p className="mt-2 text-sm" style={mutedTextStyle}>
            Live debt and expense analytics for the selected period.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 md:flex-row md:flex-wrap md:justify-end">
          {rangeKey === "custom" && (
            <>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="rounded-2xl border px-4 py-3 text-sm outline-none"
                style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="rounded-2xl border px-4 py-3 text-sm outline-none"
                style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </>
          )}

          <div
            className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <CalendarDays size={16} style={{ color: "var(--text-muted)" }} />
            <select
              value={rangeKey}
              onChange={(e) => handleRangeChange(e.target.value as RangeKey)}
              className="min-w-[13rem] bg-transparent outline-none"
              style={{ color: "var(--text-primary)" }}
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSendEmail}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <Mail size={16} />
            Email Report
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-colors"
            style={{ background: "#2563eb" }}
          >
            <Download size={16} />
            Export PDF
          </button>
        </div>
      </div>

      <div className="rounded-3xl border px-5 py-4 text-sm" style={headerCardStyle}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <span style={{ color: "var(--text-primary)" }}>{rangeMeta.selectLabel}</span>
          <span style={mutedTextStyle}>
            Budget baseline uses the previous period average monthly spending.
          </span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-[0.08em]" style={{ color: "var(--text-primary)" }}>
            Debtors (Outstanding)
          </h2>

          <div className="rounded-3xl border p-6 shadow-sm" style={panelStyle}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={mutedTextStyle}>
              Total Outstanding
            </p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <p className="text-5xl font-black" style={{ color: "#2563eb" }}>
                {formatCurrency(reportData.totalOutstanding, preferredCurrency)}
              </p>
              <div className="text-right">
                <div
                  className="inline-flex items-center gap-1 text-sm font-semibold"
                  style={{ color: reportData.outstandingDelta.isUp ? "#16a34a" : "#dc2626" }}
                >
                  {reportData.outstandingDelta.isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {reportData.outstandingDelta.value.toFixed(1)}%
                </div>
                <p className="mt-1 text-xs" style={mutedTextStyle}>
                  {reportData.outstandingDelta.text}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border p-5 shadow-sm" style={panelStyle}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-[0.06em]" style={{ color: "var(--text-primary)" }}>
                  Aging Report
                </h3>
                <span className="text-xs" style={mutedTextStyle}>
                  As of {format(reportData.referenceDate, "MMM d, yyyy")}
                </span>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {reportData.agingReport.map((bucket) => (
                  <div
                    key={bucket.label}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold"
                    style={{ background: `${bucket.color}18`, color: bucket.color }}
                  >
                    {bucket.label} ({formatCurrency(bucket.amount, preferredCurrency)})
                  </div>
                ))}
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.agingReport} layout="vertical" margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid horizontal={false} stroke={gridColor} />
                    <XAxis type="number" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fill: axisColor, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={72}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(Number(value), preferredCurrency)}
                      cursor={{ fill: isDark ? "rgba(148,163,184,0.08)" : "rgba(15,23,42,0.03)" }}
                      contentStyle={tooltipStyle}
                    />
                    <Bar dataKey="amount" radius={[0, 12, 12, 0]}>
                      {reportData.agingReport.map((bucket) => (
                        <Cell key={bucket.label} fill={bucket.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-3xl border p-5 shadow-sm" style={panelStyle}>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.06em]" style={{ color: "var(--text-primary)" }}>
                Top 5 Debtors
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr style={{ color: "var(--text-muted)" }}>
                      <th className="pb-3 font-semibold">Debtor Name</th>
                      <th className="pb-3 font-semibold">Amount</th>
                      <th className="pb-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.topDebtors.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-sm" style={mutedTextStyle}>
                          No outstanding debtors for this period.
                        </td>
                      </tr>
                    ) : (
                      reportData.topDebtors.map(({ debtor, remaining, status }) => (
                        <tr key={debtor.id} style={{ borderTop: "1px solid var(--border)" }}>
                          <td className="py-3 pr-4 font-medium" style={{ color: "var(--text-primary)" }}>
                            {debtor.debtorName}
                          </td>
                          <td className="py-3 pr-4 font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                            {formatCurrency(remaining, preferredCurrency)}
                          </td>
                          <td className="py-3 whitespace-nowrap">
                            <span className="inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold" style={getToneStyles(status.tone)}>
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-[0.08em]" style={{ color: "var(--text-primary)" }}>
            Expenses (Spent)
          </h2>

          <div className="rounded-3xl border p-6 shadow-sm" style={panelStyle}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={mutedTextStyle}>
              Total Spent
            </p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <p className="text-5xl font-black" style={{ color: "#16a34a" }}>
                {formatCurrency(reportData.totalSpent, preferredCurrency)}
              </p>
              <div className="text-right">
                <div
                  className="inline-flex items-center gap-1 text-sm font-semibold"
                  style={{ color: reportData.expenseDelta.isUp ? "#16a34a" : "#dc2626" }}
                >
                  {reportData.expenseDelta.isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {reportData.expenseDelta.value.toFixed(1)}%
                </div>
                <p className="mt-1 text-xs" style={mutedTextStyle}>
                  {reportData.expenseDelta.text}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border p-5 shadow-sm" style={panelStyle}>
              <div className="mb-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.06em]" style={{ color: "var(--text-primary)" }}>
                  Highest Expense Category
                </h3>
                <p className="mt-1 text-xs" style={mutedTextStyle}>
                  {reportData.highestCategory
                    ? `${reportData.highestCategory.name} leads this period`
                    : "No expense categories recorded in this period"}
                </p>
              </div>

              {reportData.pieEntries.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm" style={mutedTextStyle}>
                  No expense data for the selected range.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={reportData.pieEntries} dataKey="value" nameKey="name" innerRadius={56} outerRadius={86} paddingAngle={3}>
                        {reportData.pieEntries.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(Number(value), preferredCurrency)}
                        contentStyle={tooltipStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {reportData.pieEntries.map((entry) => (
                  <div key={entry.name} className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: `${entry.color}18`, color: entry.color }}>
                    {entry.name} ({Math.round((entry.value / Math.max(reportData.totalSpent, 1)) * 100)}%)
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border p-5 shadow-sm" style={panelStyle}>
              <div className="mb-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.06em]" style={{ color: "var(--text-primary)" }}>
                  Monthly Budget vs. Actual
                </h3>
                <p className="mt-1 text-xs" style={mutedTextStyle}>
                  Budget is the monthly baseline derived from the previous period.
                </p>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reportData.budgetSeries} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke={gridColor} strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: axisColor, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => formatCurrency(Number(value), preferredCurrency)}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatCurrency(Number(value), preferredCurrency),
                        name === "actual" ? "Actual" : "Budget",
                      ]}
                      contentStyle={tooltipStyle}
                    />
                    <Line type="monotone" dataKey="actual" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="budget" stroke="#64748b" strokeWidth={2} strokeDasharray="6 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-black uppercase tracking-[0.08em]" style={{ color: "var(--text-primary)" }}>
          Transaction Ledger
        </h2>

        <div className="rounded-3xl border shadow-sm" style={panelStyle}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
                <tr>
                  <th className="px-5 py-4 font-semibold">Date</th>
                  <th className="px-5 py-4 font-semibold">Type</th>
                  <th className="px-5 py-4 font-semibold">Description</th>
                  <th className="px-5 py-4 font-semibold">Category</th>
                  <th className="px-5 py-4 text-right font-semibold">Amount</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData.ledgerRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center text-sm" style={mutedTextStyle}>
                      No transactions found in the selected range.
                    </td>
                  </tr>
                ) : (
                  reportData.ledgerRows.map((row) => (
                    <tr key={row.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-5 py-4" style={{ color: "var(--text-secondary)" }}>
                        {format(row.date, "yyyy-MM-dd")}
                      </td>
                      <td className="px-5 py-4 font-medium" style={{ color: "var(--text-primary)" }}>
                        {row.type}
                      </td>
                      <td className="px-5 py-4" style={{ color: "var(--text-primary)" }}>
                        {row.description}
                      </td>
                      <td className="px-5 py-4" style={{ color: "var(--text-secondary)" }}>
                        {row.category}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold" style={{ color: row.amount >= 0 ? "#16a34a" : "var(--text-primary)" }}>
                        {row.amount >= 0 ? "+" : "-"}
                        {formatCurrency(Math.abs(row.amount), preferredCurrency)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold" style={getToneStyles(row.status.tone)}>
                          {row.status.label}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
