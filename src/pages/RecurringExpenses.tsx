import React, { useEffect, useMemo, useState } from "react";
import { addDays, format, isBefore, startOfDay } from "date-fns";
import { useAuth } from "../context/AuthContext";
import { type Expense, type RecurringFrequency, useData } from "../context/DataContext";
import { useApp } from "../context/AppContext";
import IconSelector from "../components/IconSelector";
import { formatCurrency } from "../utils/format";
import {
  buildRecurringOccurrences,
  getNextRecurringDate,
  getRecurringFrequency,
  getRecurringStatus,
  getRecurringStatusLabel,
  isRecurringExpense,
  toMonthlyRecurringAmount,
} from "../utils/recurring";
import {
  Bell,
  CalendarDays,
  Download,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat2,
  Trash2,
  X,
} from "lucide-react";
import * as Icons from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type FilterTab = "all" | "active" | "paused";

interface RecurringExpenseForm {
  subject: string;
  merchant: string;
  amount: string;
  category: string;
  frequency: RecurringFrequency;
  date: string;
  endDate: string;
  description: string;
  paymentMethod: Expense["paymentMethod"];
  currency: string;
  icon: string;
  recurringNotifications: boolean;
}

const PAGE_SIZE = 6;

function getRowIcon(iconName?: string) {
  if (!iconName) return Repeat2;
  return (Icons[iconName as keyof typeof Icons] as React.ComponentType<any>) || Repeat2;
}

export default function RecurringExpenses() {
  const { currentUser } = useAuth();
  const { expenses, categories, addExpense, updateExpense, deleteExpense, loading } = useData();
  const { currency: preferredCurrency } = useApp();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [error, setError] = useState("");
  const [formState, setFormState] = useState<RecurringExpenseForm>({
    subject: "",
    merchant: "",
    amount: "",
    category: "",
    frequency: "Monthly",
    date: new Date().toISOString().split("T")[0],
    endDate: "",
    description: "",
    paymentMethod: "",
    currency: preferredCurrency,
    icon: "",
    recurringNotifications: true,
  });

  const today = startOfDay(new Date());
  const recurringExpenses = useMemo(
    () => expenses.filter((expense) => isRecurringExpense(expense)),
    [expenses],
  );

  const recurringRows = useMemo(() => {
    return recurringExpenses
      .map((expense) => {
        const nextDate = getNextRecurringDate(expense, today);
        const status = getRecurringStatusLabel(expense, today);
        return {
          expense,
          nextDate,
          status,
          sortDate: nextDate?.getTime() ?? Number.MAX_SAFE_INTEGER,
        };
      })
      .sort((a, b) => a.sortDate - b.sortDate || a.expense.subject.localeCompare(b.expense.subject));
  }, [recurringExpenses, today]);

  const activeRecurring = useMemo(
    () => recurringRows.filter((row) => row.status === "Active"),
    [recurringRows],
  );

  const filteredRows = useMemo(() => {
    switch (activeTab) {
      case "active":
        return recurringRows.filter((row) => row.status === "Active");
      case "paused":
        return recurringRows.filter((row) => row.status === "Paused");
      case "all":
      default:
        return recurringRows;
    }
  }, [activeTab, recurringRows]);

  const pageCount = Math.max(Math.ceil(filteredRows.length / PAGE_SIZE), 1);
  const paginatedRows = filteredRows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const monthlyTotal = useMemo(
    () => activeRecurring.reduce((sum, row) => sum + toMonthlyRecurringAmount(row.expense), 0),
    [activeRecurring],
  );

  const dueWithinWeek = useMemo(() => {
    const deadline = addDays(today, 7);
    return activeRecurring.filter((row) => row.nextDate && !isBefore(deadline, row.nextDate));
  }, [activeRecurring, today]);

  const nextThirtyDays = useMemo(
    () => buildRecurringOccurrences(activeRecurring.map((row) => row.expense), today, addDays(today, 29)),
    [activeRecurring, today],
  );

  const estimatedOutflow = useMemo(
    () => nextThirtyDays.reduce((sum, item) => sum + item.expense.amount, 0),
    [nextThirtyDays],
  );

  const nextDue = dueWithinWeek
    .slice()
    .sort((a, b) => (a.nextDate?.getTime() ?? 0) - (b.nextDate?.getTime() ?? 0))[0];

  useEffect(() => {
    setCurrentPage(0);
  }, [activeTab, filteredRows.length]);

  useEffect(() => {
    if (!formState.category && categories[0] && isModalOpen && !editingExpense) {
      setFormState((prev) => ({ ...prev, category: categories[0].name }));
    }
  }, [categories, editingExpense, formState.category, isModalOpen]);

  const resetForm = () => {
    setFormState({
      subject: "",
      merchant: "",
      amount: "",
      category: categories[0]?.name || "",
      frequency: "Monthly",
      date: new Date().toISOString().split("T")[0],
      endDate: "",
      description: "",
      paymentMethod: "",
      currency: preferredCurrency,
      icon: "",
      recurringNotifications: true,
    });
    setEditingExpense(null);
    setError("");
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setFormState({
      subject: expense.subject,
      merchant: expense.merchant,
      amount: String(expense.amount),
      category: expense.category,
      frequency: getRecurringFrequency(expense),
      date: expense.date,
      endDate: expense.endDate || "",
      description: expense.description || "",
      paymentMethod: expense.paymentMethod || "",
      currency: expense.currency || preferredCurrency,
      icon: expense.icon || "",
      recurringNotifications: expense.recurringNotifications ?? true,
    });
    setError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      if (!formState.subject.trim() || !formState.amount || !formState.category || !formState.date || !formState.merchant.trim()) {
        throw new Error("Please complete the required recurring expense fields.");
      }

      const amount = Number(formState.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Amount must be greater than zero.");
      }

      const payload = {
        subject: formState.subject.trim(),
        merchant: formState.merchant.trim(),
        amount,
        category: formState.category,
        description: formState.description.trim(),
        date: formState.date,
        currency: formState.currency,
        reimbursable: editingExpense?.reimbursable ?? false,
        employee: editingExpense?.employee || currentUser?.displayName || currentUser?.email || "Unknown",
        addToReport: editingExpense?.addToReport ?? true,
        tags: editingExpense?.tags || [],
        isRecurring: true,
        frequency: formState.frequency,
        endDate: formState.endDate,
        recurringStatus: editingExpense?.recurringStatus || "active",
        recurringNotifications: formState.recurringNotifications,
        icon: formState.icon,
        paymentMethod: formState.paymentMethod || "",
      };

      if (editingExpense) {
        await updateExpense(editingExpense.id, payload);
      } else {
        await addExpense(payload);
      }

      closeModal();
    } catch (err: any) {
      setError(err.message || "Failed to save recurring expense.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePause = async (expense: Expense) => {
    const nextStatus = getRecurringStatus(expense) === "paused" ? "active" : "paused";
    await updateExpense(expense.id, { recurringStatus: nextStatus });
  };

  const handleToggleNotifications = async (expense: Expense) => {
    await updateExpense(expense.id, {
      recurringNotifications: !(expense.recurringNotifications ?? true),
    });
  };

  const handleDelete = async (expense: Expense) => {
    const confirmed = window.confirm(`Delete recurring expense "${expense.subject}"?`);
    if (!confirmed) return;
    await deleteExpense(expense.id);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const rows = nextThirtyDays
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((item) => [
        format(item.date, "MMM d, yyyy"),
        item.expense.subject,
        item.expense.merchant || "N/A",
        getRecurringFrequency(item.expense),
        formatCurrency(item.expense.amount, item.expense.currency || preferredCurrency),
      ]);

    doc.setFillColor(17, 24, 39);
    doc.rect(0, 0, pageWidth, 28, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235);
    doc.text("Recurring Expenses", 14, 18);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(209, 213, 219);
    doc.text("Upcoming 30-day schedule", pageWidth - 14, 18, { align: "right" });

    doc.setTextColor(75, 85, 99);
    doc.setFontSize(10);
    doc.text(`Estimated outflow: ${formatCurrency(estimatedOutflow, preferredCurrency)}`, 14, 40);

    autoTable(doc, {
      startY: 48,
      head: [["Date", "Expense", "Merchant", "Frequency", "Amount"]],
      body: rows.length > 0 ? rows : [["No upcoming items", "", "", "", ""]],
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
      },
      alternateRowStyles: { fillColor: [246, 248, 252] },
      bodyStyles: { textColor: [31, 41, 55] },
      margin: { left: 14, right: 14 },
    });

    doc.save(`strawberry-recurring-expenses-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  if (loading) {
    return <div style={{ color: "var(--text-primary)" }}>Loading recurring expenses...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            Recurring Expenses
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            Manage subscriptions, fixed bills, and automated monthly costs in one place.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700"
          style={{ background: "#2563eb" }}
        >
          <Plus size={18} />
          Add Recurring Expense
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div
          className="rounded-3xl border p-6 shadow-sm"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
            Monthly Total
          </p>
          <p className="mt-3 text-4xl font-black" style={{ color: "var(--text-primary)" }}>
            {formatCurrency(monthlyTotal, preferredCurrency)}
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            Estimated normalized monthly spend across active recurring expenses.
          </p>
        </div>

        <div
          className="rounded-3xl border p-6 shadow-sm"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
            Active Subscriptions
          </p>
          <p className="mt-3 text-4xl font-black" style={{ color: "var(--text-primary)" }}>
            {activeRecurring.length}
          </p>
          <p className="mt-2 text-xs text-green-500">
            {activeRecurring.length > 0 ? "All active items are included in calendar scheduling." : "No active recurring expenses yet."}
          </p>
        </div>

        <div
          className="rounded-3xl border p-6 shadow-sm"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
            Upcoming in 7 Days
          </p>
          <p className="mt-3 text-4xl font-black" style={{ color: "var(--text-primary)" }}>
            {formatCurrency(dueWithinWeek.reduce((sum, row) => sum + row.expense.amount, 0), preferredCurrency)}
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            {nextDue?.nextDate
              ? `Next: ${nextDue.expense.subject} on ${format(nextDue.nextDate, "MMM d")}`
              : "No recurring expenses are due in the next week."}
          </p>
        </div>
      </div>

      <div
        className="rounded-3xl border shadow-sm"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <div className="border-b px-6 pt-6" style={{ borderColor: "var(--border)" }}>
          <div className="flex gap-6 text-sm font-semibold">
            {[
              { id: "all", label: "All Expenses", count: recurringRows.length },
              { id: "active", label: "Active", count: activeRecurring.length },
              {
                id: "paused",
                label: "Paused",
                count: recurringRows.filter((row) => row.status === "Paused").length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as FilterTab)}
                className="border-b-2 pb-3 transition-colors"
                style={{
                  borderColor: activeTab === tab.id ? "#2563eb" : "transparent",
                  color: activeTab === tab.id ? "#2563eb" : "var(--text-muted)",
                }}
              >
                {tab.label} <span className="opacity-70">{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead style={{ background: "var(--bg-elevated)" }}>
              <tr style={{ color: "var(--text-muted)" }}>
                <th className="px-6 py-4 font-semibold">Expense Name</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Frequency</th>
                <th className="px-6 py-4 font-semibold">Next Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Notifications</th>
                <th className="px-6 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center" style={{ color: "var(--text-muted)" }}>
                    No recurring expenses match this view.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const Icon = getRowIcon(row.expense.icon);
                  const notificationsEnabled = row.expense.recurringNotifications ?? true;
                  return (
                    <tr key={row.expense.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-11 w-11 items-center justify-center rounded-2xl"
                            style={{ background: "var(--bg-elevated)", color: "var(--accent)" }}
                          >
                            <Icon size={18} />
                          </div>
                          <div>
                            <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                              {row.expense.subject}
                            </div>
                            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {row.expense.category} · {row.expense.merchant}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 font-semibold" style={{ color: "var(--text-primary)" }}>
                        {formatCurrency(row.expense.amount, row.expense.currency || preferredCurrency)}
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className="rounded-full px-3 py-1 text-xs font-semibold"
                          style={{ background: "var(--bg-elevated)", color: "#2563eb" }}
                        >
                          {getRecurringFrequency(row.expense)}
                        </span>
                      </td>
                      <td className="px-6 py-5" style={{ color: "var(--text-secondary)" }}>
                        {row.nextDate ? format(row.nextDate, "MMM d, yyyy") : "Ended"}
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className="rounded-full px-3 py-1 text-xs font-semibold"
                          style={{
                            background:
                              row.status === "Active"
                                ? "rgba(34, 197, 94, 0.12)"
                                : row.status === "Paused"
                                  ? "rgba(245, 158, 11, 0.15)"
                                  : "var(--bg-elevated)",
                            color:
                              row.status === "Active"
                                ? "#16a34a"
                                : row.status === "Paused"
                                  ? "#d97706"
                                  : "var(--text-muted)",
                          }}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <button
                          type="button"
                          onClick={() => handleToggleNotifications(row.expense)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors"
                          style={{
                            borderColor: notificationsEnabled ? "#2563eb" : "var(--border)",
                            background: notificationsEnabled ? "#2563eb" : "transparent",
                            color: notificationsEnabled ? "#fff" : "var(--text-muted)",
                          }}
                          title={notificationsEnabled ? "Disable notifications" : "Enable notifications"}
                        >
                          <Bell size={15} />
                        </button>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(row.expense)}
                            className="rounded-xl p-2 transition-colors"
                            style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
                            title="Edit recurring expense"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTogglePause(row.expense)}
                            className="rounded-xl p-2 transition-colors"
                            style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
                            title={getRecurringStatus(row.expense) === "paused" ? "Resume recurring expense" : "Pause recurring expense"}
                          >
                            {getRecurringStatus(row.expense) === "paused" ? <Play size={16} /> : <Pause size={16} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row.expense)}
                            className="rounded-xl p-2 transition-colors"
                            style={{ background: "rgba(239, 68, 68, 0.12)", color: "#dc2626" }}
                            title="Delete recurring expense"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div
          className="flex flex-col gap-3 border-t px-6 py-4 text-sm md:flex-row md:items-center md:justify-between"
          style={{ borderColor: "var(--border)" }}
        >
          <p style={{ color: "var(--text-muted)" }}>
            Showing {paginatedRows.length} of {filteredRows.length} recurring expenses
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(page - 1, 0))}
              disabled={currentPage === 0}
              className="rounded-xl border px-4 py-2 transition-colors disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(page + 1, pageCount - 1))}
              disabled={currentPage >= pageCount - 1}
              className="rounded-xl border px-4 py-2 transition-colors disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div
        className="rounded-3xl border p-6 shadow-sm"
        style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(59,130,246,0.02))", borderColor: "var(--border)" }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Upcoming Totals
            </p>
            <h3 className="mt-3 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Estimated outflow for the next 30 days
            </h3>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Calendar scheduling uses this same recurring forecast, so due dates stay aligned across the app.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
              <CalendarDays size={16} />
              {nextThirtyDays.length} scheduled charges
            </div>
            <div className="text-4xl font-black" style={{ color: "#2563eb" }}>
              {formatCurrency(estimatedOutflow, preferredCurrency)}
            </div>
            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition-colors"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <Download size={16} />
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border p-6 shadow-2xl"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {editingExpense ? "Edit Recurring Expense" : "Add Recurring Expense"}
                </h2>
                <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                  This recurring schedule will also appear in the calendar forecast.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl p-2"
                style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
              >
                <X size={18} />
              </button>
            </div>

            <form className="space-y-6" onSubmit={handleSave}>
              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Expense Name
                  </label>
                  <input
                    type="text"
                    value={formState.subject}
                    onChange={(e) => setFormState((prev) => ({ ...prev, subject: e.target.value }))}
                    className="w-full rounded-2xl border px-4 py-3 outline-none"
                    style={{ background: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    placeholder="Netflix, Rent, Domain Renewal"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.amount}
                    onChange={(e) => setFormState((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full rounded-2xl border px-4 py-3 outline-none"
                    style={{ background: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Currency
                  </label>
                  <select
                    value={formState.currency}
                    onChange={(e) => setFormState((prev) => ({ ...prev, currency: e.target.value }))}
                    className="w-full rounded-2xl border px-4 py-3 outline-none"
                    style={{ background: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="USD">USD</option>
                    <option value="LKR">LKR</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Category
                  </label>
                  <select
                    value={formState.category}
                    onChange={(e) => setFormState((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full rounded-2xl border px-4 py-3 outline-none"
                    style={{ background: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="" disabled>Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Merchant
                  </label>
                  <input
                    type="text"
                    value={formState.merchant}
                    onChange={(e) => setFormState((prev) => ({ ...prev, merchant: e.target.value }))}
                    className="w-full rounded-2xl border px-4 py-3 outline-none"
                    style={{ background: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    placeholder="Merchant or provider"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Frequency
                  </label>
                  <select
                    value={formState.frequency}
                    onChange={(e) => setFormState((prev) => ({ ...prev, frequency: e.target.value as RecurringFrequency }))}
                    className="w-full rounded-2xl border px-4 py-3 outline-none"
                    style={{ background: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    First Charge Date
                  </label>
                  <input
                    type="date"
                    value={formState.date}
                    onChange={(e) => setFormState((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full rounded-2xl border px-4 py-3 outline-none"
                    style={{ background: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formState.endDate}
                    onChange={(e) => setFormState((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="w-full rounded-2xl border px-4 py-3 outline-none"
                    style={{ background: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>

                <div className="md:col-span-2">
                  <IconSelector
                    selectedIcon={formState.icon}
                    onIconSelect={(icon) => setFormState((prev) => ({ ...prev, icon }))}
                    category={formState.category}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Payment Method
                  </label>
                  <select
                    value={formState.paymentMethod}
                    onChange={(e) => setFormState((prev) => ({ ...prev, paymentMethod: e.target.value as Expense["paymentMethod"] }))}
                    className="w-full rounded-2xl border px-4 py-3 outline-none"
                    style={{ background: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="">Not set</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="debit_card">Debit Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <label
                  className="flex items-center justify-between rounded-2xl border px-4 py-3"
                  style={{ background: "var(--bg-base)", borderColor: "var(--border)" }}
                >
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      Enable notifications
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Stores whether reminders should be enabled for this recurring expense.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formState.recurringNotifications}
                    onChange={(e) => setFormState((prev) => ({ ...prev, recurringNotifications: e.target.checked }))}
                    className="h-5 w-5 accent-blue-600"
                  />
                </label>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Description
                  </label>
                  <textarea
                    rows={4}
                    value={formState.description}
                    onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full rounded-2xl border px-4 py-3 outline-none"
                    style={{ background: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    placeholder="Optional notes about this recurring expense."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-2xl border px-5 py-3 font-semibold transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-2xl px-5 py-3 font-semibold text-white transition-colors disabled:opacity-50"
                  style={{ background: "#2563eb" }}
                >
                  {isSaving ? "Saving..." : editingExpense ? "Save Changes" : "Create Recurring Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
