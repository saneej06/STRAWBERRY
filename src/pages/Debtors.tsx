import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { useData } from "../context/DataContext";
import { useApp } from "../context/AppContext";
import { Ellipsis, FileDown, Mail, PencilLine, Phone, Plus, ReceiptText, Save, Trash2, X } from "lucide-react";
import { formatCurrency } from "../utils/format";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function getDebtorStatusMeta(debtor: {
  status: "pending" | "paid";
  date: string;
  amount: number;
  paidAmount: number;
}) {
  if (debtor.status === "paid" || Math.max(0, Number(debtor.amount || 0) - Number(debtor.paidAmount || 0)) <= 0) {
    return {
      label: "Paid",
      badgeClass: "bg-emerald-600 border-emerald-700",
    };
  }

  const dueDate = new Date(`${debtor.date}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) {
    return {
      label: "Pending",
      badgeClass: "bg-amber-500 border-amber-600",
    };
  }

  const dayDiff = differenceInCalendarDays(startOfDay(new Date()), startOfDay(dueDate));

  if (dayDiff > 0) {
    return {
      label: `Overdue by ${dayDiff} day${dayDiff === 1 ? "" : "s"}`,
      badgeClass: "bg-red-600 border-red-700",
    };
  }

  if (dayDiff === 0) {
    return {
      label: "Due today",
      badgeClass: "bg-orange-500 border-orange-600",
    };
  }

  const daysRemaining = Math.abs(dayDiff);
  return {
    label: `Due in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
    badgeClass: "bg-amber-500 border-amber-600",
  };
}

export default function Debtors() {
  const { debtors, expenses, payments, addDebtor, updateDebtor, deleteDebtor, loading } = useData();
  const { currency, theme } = useApp();
  const navigate = useNavigate();

  const [showAddForm, setShowAddForm] = useState(false);
  const [openCardMenuId, setOpenCardMenuId] = useState<string | null>(null);
  const [editingDebtorId, setEditingDebtorId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    debtorName: "",
    phoneNumber: "",
    email: "",
    amount: "",
    notes: "",
  });
  const [showDeleteConfirmId, setShowDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    debtorName: "",
    phoneNumber: "",
    email: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const modalRoot = typeof document !== "undefined" ? document.body : null;
  const isDark = theme === "dark";

  useEffect(() => {
    if (!showAddForm) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [showAddForm]);

  if (loading) {
    return <div style={{ color: "var(--text-primary)" }}>Loading debtors...</div>;
  }

  const totalDebt = debtors.reduce((sum, debtor) => sum + Number(debtor.amount || 0), 0);
  const amountCollected = debtors.reduce((sum, debtor) => sum + Number(debtor.paidAmount || 0), 0);
  const remainingBalance = Math.max(0, totalDebt - amountCollected);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.debtorName || !formData.amount || !formData.date) return;
    await addDebtor({
      debtorName: formData.debtorName,
      phoneNumber: formData.phoneNumber,
      email: formData.email,
      amount: Number(formData.amount),
      paidAmount: 0,
      date: formData.date,
      notes: formData.notes,
      status: "pending",
    });
    setFormData({
      debtorName: "",
      phoneNumber: "",
      email: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setShowAddForm(false);
  };

  const openEditDebtor = (debtorId: string) => {
    const debtor = debtors.find((d) => d.id === debtorId);
    if (!debtor) return;
    setEditForm({
      debtorName: debtor.debtorName || "",
      phoneNumber: debtor.phoneNumber || "",
      email: debtor.email || "",
      amount: String(debtor.amount || ""),
      notes: debtor.notes || "",
    });
    setEditingDebtorId(debtorId);
    setOpenCardMenuId(null);
  };

  const saveEditedDebtor = async () => {
    if (!editingDebtorId) return;
    const amount = Number(editForm.amount);
    if (!editForm.debtorName.trim() || !Number.isFinite(amount) || amount < 0) return;
    await updateDebtor(editingDebtorId, {
      debtorName: editForm.debtorName.trim(),
      phoneNumber: editForm.phoneNumber.trim(),
      email: editForm.email.trim(),
      amount,
      notes: editForm.notes.trim(),
    });
    setEditingDebtorId(null);
  };

  const exportDebtorPdf = (debtorId: string) => {
    const debtor = debtors.find((d) => d.id === debtorId);
    if (!debtor) return;
    const debtorPayments = payments
      .filter((payment) => payment.debtorId === debtorId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const paid = Number(debtor.paidAmount || 0);
    const total = Number(debtor.amount || 0);
    const balance = Math.max(0, total - paid);

    const doc = new jsPDF();
    const width = doc.internal.pageSize.getWidth();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, width, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("STRAWBERRY Debtor Report", 14, 17);

    doc.setTextColor(40, 40, 50);
    doc.setFontSize(11);
    doc.text(`Name: ${debtor.debtorName}`, 14, 40);
    doc.text(`Phone: ${debtor.phoneNumber || "N/A"}`, 14, 46);
    doc.text(`Email: ${debtor.email || "N/A"}`, 14, 52);
    doc.text(`Notes: ${debtor.notes || "N/A"}`, 14, 58);
    doc.text(`Total Debt: ${formatCurrency(total, currency)}`, 14, 66);
    doc.text(`Amount Paid: ${formatCurrency(paid, currency)}`, 14, 72);
    doc.text(`Remaining Balance: ${formatCurrency(balance, currency)}`, 14, 78);

    autoTable(doc, {
      startY: 86,
      head: [["Date", "Amount Paid", "Method"]],
      body:
        debtorPayments.length > 0
          ? debtorPayments.map((payment) => [payment.date || "", formatCurrency(payment.amount, currency), payment.method || "Manual Entry"])
          : [["-", "No payment history", "-"]],
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14 },
    });

    doc.save(`debtor-${debtor.debtorName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    setOpenCardMenuId(null);
  };

  const deleteDebtorFromCard = async (debtorId: string) => {
    await deleteDebtor(debtorId);
    setShowDeleteConfirmId(null);
    setOpenCardMenuId(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-4xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Total Receivables
        </h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium"
          style={{ background: "#1d4d8f" }}
        >
          <Plus size={18} />
          Add Debtor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg p-4 text-white" style={{ background: "#1f4d8f" }}>
          <p className="text-sm opacity-90">Total Debt</p>
          <p className="text-4xl font-semibold">{formatCurrency(totalDebt, currency)}</p>
        </div>
        <div className="rounded-lg p-4 text-white" style={{ background: "#148f84" }}>
          <p className="text-sm opacity-90">Amount Collected</p>
          <p className="text-4xl font-semibold">{formatCurrency(amountCollected, currency)}</p>
        </div>
        <div className="rounded-lg p-4 text-white" style={{ background: "#6d7784" }}>
          <p className="text-sm opacity-90">Remaining Balance</p>
          <p className="text-4xl font-semibold">{formatCurrency(remainingBalance, currency)}</p>
        </div>
      </div>

      {debtors.length === 0 ? (
        <div className="rounded-xl border p-8 text-center" style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
          No debtors found.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {debtors.map((debtor) => {
            const paid = Number(debtor.paidAmount || 0);
            const total = Number(debtor.amount || 0);
            const balance = Math.max(0, total - paid);
            const percentPaid = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
            const linkedExpense = expenses.find((expense) => expense.id === debtor.expenseId);
            const category = linkedExpense?.category || debtor.notes || "General";
            const statusMeta = getDebtorStatusMeta({
              status: debtor.status,
              date: debtor.date,
              amount: total,
              paidAmount: paid,
            });

            return (
              <div
                key={debtor.id}
                className="rounded-lg border overflow-visible cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
                onClick={() => navigate(`/debtors/${debtor.id}`)}
              >
                <div className={`px-4 py-2 border-b ${statusMeta.badgeClass}`}>
                  <span className="inline-flex items-center px-3 py-0.5 rounded-full border text-xs font-semibold uppercase tracking-wide text-white border-white/50">
                    {statusMeta.label}
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p style={{ color: "var(--text-muted)" }}>Name</p>
                      <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{debtor.debtorName}</p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-muted)" }}>Phone</p>
                      <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{debtor.phoneNumber || "-"}</p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-muted)" }}>Category</p>
                      <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{category}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span style={{ color: "var(--text-primary)" }}>Paid</span>
                      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                        {formatCurrency(paid, currency)} ({percentPaid.toFixed(0)}%) of {formatCurrency(total, currency)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: "var(--bg-muted)" }}>
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${percentPaid}%`,
                          background: debtor.status === "paid" ? "#1f9d55" : "#c0c6d0",
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 border-t flex items-center justify-between gap-2" style={{ borderColor: "var(--border)" }}>
                  <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                    Balance: {formatCurrency(balance, currency)}
                  </p>
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setOpenCardMenuId((prev) => (prev === debtor.id ? null : debtor.id))}
                      className="w-10 h-10 rounded-lg border inline-flex items-center justify-center"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--bg-elevated)" }}
                    >
                      <Ellipsis size={16} />
                    </button>
                    {openCardMenuId === debtor.id && (
                      <div
                        className="absolute right-0 top-full mt-2 w-44 rounded-xl border shadow-xl overflow-hidden z-50"
                        style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
                      >
                        <button
                          onClick={() => openEditDebtor(debtor.id)}
                          className="w-full px-4 py-3 text-left inline-flex items-center gap-2 text-sm font-medium hover:bg-black/5"
                          style={{ color: "var(--text-primary)" }}
                        >
                          <PencilLine size={15} />
                          Edit
                        </button>
                        <button
                          onClick={() => exportDebtorPdf(debtor.id)}
                          className="w-full px-4 py-3 text-left inline-flex items-center gap-2 text-sm font-medium hover:bg-black/5 border-t"
                          style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
                        >
                          <FileDown size={15} />
                          Export
                        </button>
                        <button
                          onClick={() => {
                            setShowDeleteConfirmId(debtor.id);
                            setOpenCardMenuId(null);
                          }}
                          className="w-full px-4 py-3 text-left inline-flex items-center gap-2 text-sm font-medium hover:bg-red-500/10 border-t text-red-500"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <Trash2 size={15} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddForm && modalRoot && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/55 flex items-center justify-center p-4">
          <div
            className="w-full max-w-2xl rounded-2xl border shadow-2xl p-6 sm:p-7"
            style={{
              borderColor: isDark ? "rgba(96,165,250,0.45)" : "rgba(37,99,235,0.30)",
              background: isDark
                ? "linear-gradient(180deg, rgba(10,23,56,0.98) 0%, rgba(4,12,32,0.98) 100%)"
                : "linear-gradient(180deg, rgba(245,249,255,0.98) 0%, rgba(230,239,255,0.98) 100%)",
              boxShadow: isDark
                ? "0 30px 80px rgba(3, 8, 22, 0.7), inset 0 1px 0 rgba(96,165,250,0.4)"
                : "0 24px 70px rgba(15, 23, 42, 0.25), inset 0 1px 0 rgba(255,255,255,0.8)",
            }}
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-4xl font-bold tracking-tight" style={{ color: isDark ? "#f8fbff" : "#0f172a" }}>
                  Add New Debtor
                </h3>
                <p className="text-sm mt-1" style={{ color: isDark ? "rgba(203,213,225,0.9)" : "rgba(51,65,85,0.85)" }}>
                  Input firm details and outstanding balances for the ledger entry.
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(false)}
                className="w-10 h-10 rounded-xl border inline-flex items-center justify-center"
                style={{
                  borderColor: isDark ? "rgba(148,163,184,0.35)" : "rgba(148,163,184,0.45)",
                  color: isDark ? "#cbd5e1" : "#475569",
                  background: isDark ? "rgba(15,23,42,0.45)" : "rgba(255,255,255,0.6)",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: isDark ? "#dbeafe" : "#334155" }}>
                  Debtor Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp Publishing"
                  value={formData.debtorName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, debtorName: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border outline-none"
                  style={{
                    background: isDark ? "rgba(3,10,28,0.72)" : "rgba(255,255,255,0.9)",
                    borderColor: isDark ? "rgba(125,211,252,0.45)" : "rgba(59,130,246,0.35)",
                    color: isDark ? "#f8fafc" : "#0f172a",
                  }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: isDark ? "#dbeafe" : "#334155" }}>
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: isDark ? "#94a3b8" : "#64748b" }} />
                    <input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                      className="w-full pl-10 pr-3 py-3 rounded-xl border outline-none"
                      style={{
                        background: isDark ? "rgba(3,10,28,0.72)" : "rgba(255,255,255,0.9)",
                        borderColor: isDark ? "rgba(125,211,252,0.45)" : "rgba(59,130,246,0.35)",
                        color: isDark ? "#f8fafc" : "#0f172a",
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: isDark ? "#dbeafe" : "#334155" }}>
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: isDark ? "#94a3b8" : "#64748b" }} />
                    <input
                      type="email"
                      placeholder="billing@acmecorp.com"
                      value={formData.email}
                      onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full pl-10 pr-3 py-3 rounded-xl border outline-none"
                      style={{
                        background: isDark ? "rgba(3,10,28,0.72)" : "rgba(255,255,255,0.9)",
                        borderColor: isDark ? "rgba(125,211,252,0.45)" : "rgba(59,130,246,0.35)",
                        color: isDark ? "#f8fafc" : "#0f172a",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: isDark ? "#dbeafe" : "#334155" }}>
                  Total Amount Due
                </label>
                <div className="flex items-end gap-2">
                  <ReceiptText size={28} style={{ color: isDark ? "#cbd5e1" : "#475569" }} />
                  <input
                    type="number"
                    required
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full text-4xl font-bold bg-transparent border-0 outline-none p-0"
                    style={{ color: isDark ? "#f8fafc" : "#0f172a" }}
                  />
                </div>
                <input type="date" value={formData.date} onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))} className="sr-only" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: isDark ? "#dbeafe" : "#334155" }}>
                  Description & Notes
                </label>
                <textarea
                  rows={4}
                  placeholder="Provide additional context regarding the debt structure or payment terms..."
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border outline-none resize-none"
                  style={{
                    background: isDark ? "rgba(3,10,28,0.72)" : "rgba(255,255,255,0.9)",
                    borderColor: isDark ? "rgba(125,211,252,0.45)" : "rgba(59,130,246,0.35)",
                    color: isDark ? "#f8fafc" : "#0f172a",
                  }}
                />
              </div>

              <div className="pt-4 border-t space-y-2" style={{ borderColor: isDark ? "rgba(71,85,105,0.6)" : "rgba(148,163,184,0.45)" }}>
                <button
                  type="submit"
                  className="w-full px-5 py-3 rounded-xl font-semibold text-white inline-flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%)",
                    boxShadow: "0 8px 24px rgba(37, 99, 235, 0.35)",
                  }}
                >
                  <Save size={16} />
                  Save Debtor
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="w-full py-2.5 text-sm"
                  style={{ color: isDark ? "#94a3b8" : "#475569" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>,
        modalRoot,
      )}

      {editingDebtorId && modalRoot && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/55 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border shadow-2xl p-6" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-3xl font-bold" style={{ color: "#1d4ed8" }}>Edit Debtor Profile</h3>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                  Update identification details and financial commitment notes.
                </p>
              </div>
              <button
                onClick={() => setEditingDebtorId(null)}
                className="w-10 h-10 rounded-xl border inline-flex items-center justify-center"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                value={editForm.debtorName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, debtorName: e.target.value }))}
                className="px-4 py-3 rounded-xl border outline-none"
                placeholder="Debtor name"
                style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
              <input
                type="number"
                step="0.01"
                value={editForm.amount}
                onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))}
                className="px-4 py-3 rounded-xl border outline-none"
                placeholder="Total amount"
                style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
              <input
                value={editForm.phoneNumber}
                onChange={(e) => setEditForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                className="px-4 py-3 rounded-xl border outline-none"
                placeholder="Phone number"
                style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
              <input
                value={editForm.email}
                onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                className="px-4 py-3 rounded-xl border outline-none"
                placeholder="Email address"
                style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
              <textarea
                rows={4}
                value={editForm.notes}
                onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="md:col-span-2 px-4 py-3 rounded-xl border outline-none resize-none"
                placeholder="Description & notes"
                style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>

            <div className="mt-5 p-3 rounded-xl border flex items-center gap-2 text-sm" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <Mail size={14} />
              Last edited on {new Date().toLocaleDateString()}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditingDebtorId(null)}
                className="px-5 py-2.5 rounded-xl font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                Cancel
              </button>
              <button
                onClick={saveEditedDebtor}
                className="px-6 py-2.5 rounded-xl text-white font-semibold"
                style={{ background: "#1d4ed8" }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>,
        modalRoot,
      )}

      {showDeleteConfirmId && modalRoot && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/55 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border shadow-2xl p-6 text-center" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <h3 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Delete Debtor?</h3>
            <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
              This will remove the debtor profile and related payment history.
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setShowDeleteConfirmId(null)}
                className="px-5 py-2.5 rounded-xl border font-medium"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteDebtorFromCard(showDeleteConfirmId)}
                className="px-6 py-2.5 rounded-xl text-white font-semibold"
                style={{ background: "#dc2626" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        modalRoot,
      )}
    </div>
  );
}
