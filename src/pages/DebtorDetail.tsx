import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import {
  Banknote,
  Calendar,
  CalendarDays,
  ChevronDown,
  Ellipsis,
  FileDown,
  Info,
  Landmark,
  Layers,
  Mail,
  MessageCircle,
  MessageSquare,
  PencilLine,
  Phone,
  Scale,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
  Loader2,
} from "lucide-react";
import { formatCurrency } from "../utils/format";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PAYMENT_METHODS = [
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
];

const methodLabel = (method?: string) => {
  switch (method) {
    case "credit_card":
      return "Credit Card";
    case "debit_card":
      return "Debit Card";
    case "bank_transfer":
      return "Bank Transfer";
    case "cash":
      return "Cash";
    case "cheque":
      return "Cheque";
    default:
      return method || "Manual Entry";
  }
};

function getDebtorStatusMeta(debtor: {
  status: "pending" | "paid";
  date: string;
  amount: number;
  paidAmount: number;
}) {
  if (debtor.status === "paid" || Math.max(0, Number(debtor.amount || 0) - Number(debtor.paidAmount || 0)) <= 0) {
    return {
      label: "Paid",
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    };
  }

  const dueDate = new Date(`${debtor.date}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) {
    return {
      label: "Pending",
      badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    };
  }

  const dayDiff = differenceInCalendarDays(startOfDay(new Date()), startOfDay(dueDate));

  if (dayDiff > 0) {
    return {
      label: `Overdue by ${dayDiff} day${dayDiff === 1 ? "" : "s"}`,
      badgeClass: "bg-red-100 text-red-800 border-red-300",
    };
  }

  if (dayDiff === 0) {
    return {
      label: "Due today",
      badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
    };
  }

  const daysRemaining = Math.abs(dayDiff);
  return {
    label: `Due in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
  };
}

export default function DebtorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { debtors, payments, recordDebtorPayment, deleteDebtor, updateDebtor } = useData();
  const { currentUser } = useAuth();
  const { currency } = useApp();

  const debtor = debtors.find((d) => d.id === id);
  const paymentHistory = useMemo(
    () =>
      payments
        .filter((payment) => payment.debtorId === id)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [payments, id],
  );

  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [logAmount, setLogAmount] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [logMethod, setLogMethod] = useState("");

  const [reminderChannel, setReminderChannel] = useState<"whatsapp" | "email" | "sms">("email");
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderPrompt, setReminderPrompt] = useState("");
  const [generatingReminder, setGeneratingReminder] = useState(false);
  const [reminderError, setReminderError] = useState("");

  const [editDebtorName, setEditDebtorName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const modalOpen = showLogModal || showReminderModal || showEditModal || showDeleteConfirm;
  const modalRoot = typeof document !== "undefined" ? document.body : null;

  useEffect(() => {
    if (!modalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [modalOpen]);

  if (!debtor) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p className="mb-4" style={{ color: "var(--text-primary)" }}>Debtor not found.</p>
        <Link to="/debtors" className="text-blue-600 hover:underline">Back to Debtors</Link>
      </div>
    );
  }

  const totalDebt = debtor.amount;
  const amountPaid = debtor.paidAmount || 0;
  const remaining = Math.max(0, totalDebt - amountPaid);
  const statusMeta = getDebtorStatusMeta({
    status: debtor.status,
    date: debtor.date,
    amount: totalDebt,
    paidAmount: amountPaid,
  });
  const defaultReminderMessage = `Dear ${debtor.debtorName},\n\nThis is a reminder for your outstanding balance of ${formatCurrency(
    remaining,
    currency,
  )}.\n\nPlease make payment at your earliest convenience.\n\nSincerely,\nYour Business Name`;

  const openEditModal = () => {
    setEditDebtorName(debtor.debtorName || "");
    setEditAmount(String(debtor.amount || ""));
    setEditPhone(debtor.phoneNumber || "");
    setEditEmail(debtor.email || "");
    setEditNotes(debtor.notes || "");
    setShowActionsMenu(false);
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    const amount = Number(editAmount);
    if (!editDebtorName.trim() || !Number.isFinite(amount) || amount < 0) return;
    await updateDebtor(debtor.id, {
      debtorName: editDebtorName.trim(),
      amount,
      phoneNumber: editPhone.trim(),
      email: editEmail.trim(),
      notes: editNotes.trim(),
    });
    setShowEditModal(false);
  };

  const exportPdf = () => {
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
    doc.text(`Total Debt: ${formatCurrency(totalDebt, currency)}`, 14, 66);
    doc.text(`Amount Paid: ${formatCurrency(amountPaid, currency)}`, 14, 72);
    doc.text(`Remaining Balance: ${formatCurrency(remaining, currency)}`, 14, 78);

    autoTable(doc, {
      startY: 86,
      head: [["Date", "Amount Paid", "Method"]],
      body:
        paymentHistory.length > 0
          ? paymentHistory.map((payment) => [
              payment.date || "",
              formatCurrency(payment.amount, currency),
              methodLabel(payment.method),
            ])
          : [["-", "No payment history", "-"]],
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14 },
    });

    doc.save(`debtor-${debtor.debtorName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    setShowActionsMenu(false);
  };

  const openReminder = () => {
    setReminderMessage(defaultReminderMessage);
    setReminderPrompt("");
    setReminderError("");
    setReminderChannel("email");
    setShowReminderModal(true);
  };

  const generateReminderWithAI = async () => {
    if (!currentUser || generatingReminder) return;

    setGeneratingReminder(true);
    setReminderError("");

    const guidance = reminderPrompt.trim();
    const userRequest = guidance
      ? `Write a payment reminder message for this debtor. User instructions: ${guidance}`
      : "Write a payment reminder message for this debtor. Keep it professional, concise, and ready to send.";

    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          message: `${userRequest}

Debtor name: ${debtor.debtorName}
Outstanding balance: ${formatCurrency(remaining, currency)}
Total debt: ${formatCurrency(totalDebt, currency)}
Amount already paid: ${formatCurrency(amountPaid, currency)}
Preferred channel: ${reminderChannel}
Notes: ${debtor.notes || "None"}

Return only the final reminder message body in plain text. No markdown. No explanation.`,
          context: {
            expenseSummary: {
              totalExpense: 0,
              expenseCount: 0,
              categoryTotals: {},
            },
            debtorSummary: {
              debtorCount: 1,
              totalDebt,
              totalCollected: amountPaid,
              pendingCount: debtor.status === "pending" ? 1 : 0,
              remainingBalance: remaining,
            },
            preferredCurrency: currency,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to generate reminder.");
      }

      const generatedMessage = typeof data?.text === "string" ? data.text.trim() : "";
      setReminderMessage(generatedMessage || defaultReminderMessage);
    } catch (error: any) {
      console.error("Reminder generation error:", error);
      setReminderError(error?.message || "Failed to generate reminder.");
      if (!reminderMessage.trim()) {
        setReminderMessage(defaultReminderMessage);
      }
    } finally {
      setGeneratingReminder(false);
    }
  };

  const sendNow = () => {
    const body = encodeURIComponent(reminderMessage);
    if (reminderChannel === "email") {
      window.open(`mailto:${debtor.email || ""}?subject=Payment Reminder&body=${body}`, "_self");
      return;
    }
    if (reminderChannel === "whatsapp") {
      if (!debtor.phoneNumber) return;
      const phone = debtor.phoneNumber.replace(/\D/g, "");
      window.open(`https://wa.me/${phone}?text=${body}`, "_blank");
      return;
    }
    if (!debtor.phoneNumber) return;
    window.open(`sms:${debtor.phoneNumber}?body=${body}`, "_self");
  };

  const savePayment = async () => {
    const amount = Number(logAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !logDate || !logMethod) return;
    await recordDebtorPayment(debtor.id, amount, logMethod, logDate);
    setShowLogModal(false);
  };

  const confirmDelete = async () => {
    await deleteDebtor(debtor.id);
    setShowDeleteConfirm(false);
    navigate("/debtors");
  };

  return (
    <div className="max-w-7xl mx-auto px-5 py-6 space-y-5 animate-in fade-in duration-500">
      <div className="flex justify-end items-center gap-2">
        <button onClick={() => setShowLogModal(true)} className="px-5 py-2.5 rounded-xl text-white font-semibold text-base" style={{ background: "#1f4d8f" }}>Log New Payment</button>
        <button onClick={openReminder} className="px-5 py-2.5 rounded-xl border font-semibold text-base" style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--bg-surface)" }}>
          <span className="inline-flex items-center gap-2"><Send size={16} />Send Reminder</span>
        </button>
        <button onClick={() => setShowDeleteConfirm(true)} className="px-5 py-2.5 rounded-xl border font-semibold text-base" style={{ borderColor: "rgba(239,68,68,0.45)", color: "#ef4444", background: "var(--bg-surface)" }}>
          <span className="inline-flex items-center gap-2"><Trash2 size={16} />Delete Profile</span>
        </button>
        <div className="relative">
          <button onClick={() => setShowActionsMenu((v) => !v)} className="w-11 h-11 rounded-xl border inline-flex items-center justify-center" style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--bg-surface)" }}>
            <Ellipsis size={18} />
          </button>
          {showActionsMenu && (
            <div className="absolute right-0 mt-2 w-44 rounded-xl border shadow-xl overflow-hidden z-50" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
              <button onClick={openEditModal} className="w-full px-4 py-3 text-left inline-flex items-center gap-2 text-sm font-medium hover:bg-black/5" style={{ color: "var(--text-primary)" }}><PencilLine size={16} />Edit</button>
              <button onClick={exportPdf} className="w-full px-4 py-3 text-left inline-flex items-center gap-2 text-sm font-medium hover:bg-black/5 border-t" style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}><FileDown size={16} />Export</button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border p-6 shadow-sm space-y-5" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{debtor.debtorName}</h1>
          <span className={`px-4 py-1 rounded-2xl text-2xl font-semibold border ${statusMeta.badgeClass}`}>
            {statusMeta.label}
          </span>
        </div>
        <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-4" style={{ borderColor: "var(--border)" }}>
          <div className="rounded-2xl border p-4 flex items-center gap-4 shadow-sm" style={{ borderColor: "var(--border)", background: "var(--bg-base)" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white" style={{ background: "#1f4d8f" }}><Layers size={26} /></div>
            <div><p className="text-lg md:text-xl font-medium" style={{ color: "var(--text-primary)" }}>Total Debt</p><p className="text-4xl md:text-5xl font-bold leading-tight mt-1" style={{ color: "var(--text-primary)" }}>{formatCurrency(totalDebt, currency)}</p></div>
          </div>
          <div className="rounded-2xl border p-4 flex items-center gap-4 shadow-sm" style={{ borderColor: "var(--border)", background: "var(--bg-base)" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white" style={{ background: "#8894a7" }}><Banknote size={26} /></div>
            <div><p className="text-lg md:text-xl font-medium" style={{ color: "var(--text-primary)" }}>Amount Paid</p><p className="text-4xl md:text-5xl font-bold leading-tight mt-1" style={{ color: "var(--text-primary)" }}>{formatCurrency(amountPaid, currency)}</p></div>
          </div>
          <div className="rounded-2xl border p-4 flex items-center gap-4 shadow-sm" style={{ borderColor: "var(--border)", background: "var(--bg-base)" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white" style={{ background: "#6a7380" }}><Scale size={26} /></div>
            <div><p className="text-lg md:text-xl font-medium" style={{ color: "var(--text-primary)" }}>Remaining Balance</p><p className="text-4xl md:text-5xl font-bold leading-tight mt-1" style={{ color: "var(--text-primary)" }}>{formatCurrency(remaining, currency)}</p></div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-5xl md:text-6xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Payment History</h2>
        <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
          <table className="w-full text-left">
            <thead style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
              <tr style={{ color: "var(--text-primary)" }}>
                <th className="px-5 py-4 text-xl md:text-2xl font-semibold"><span className="inline-flex items-center gap-2"><CalendarDays size={20} />Date</span></th>
                <th className="px-5 py-4 text-xl md:text-2xl font-semibold"><span className="inline-flex items-center gap-2"><Banknote size={20} />Amount Paid</span></th>
                <th className="px-5 py-4 text-xl md:text-2xl font-semibold"><span className="inline-flex items-center gap-2"><Landmark size={20} />Method</span></th>
              </tr>
            </thead>
            <tbody>
              {paymentHistory.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>No payments recorded yet.</td></tr>
              ) : (
                paymentHistory.map((payment) => (
                  <tr key={payment.id} className="border-t" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                    <td className="px-5 py-4 text-lg md:text-xl">{payment.date}</td>
                    <td className="px-5 py-4 text-lg md:text-xl">{formatCurrency(payment.amount, currency)}</td>
                    <td className="px-5 py-4 text-lg md:text-xl">{methodLabel(payment.method)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showLogModal && modalRoot && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-xl rounded-2xl border shadow-2xl" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Log New Payment</h3>
              <button onClick={() => setShowLogModal(false)} className="w-9 h-9 rounded-lg inline-flex items-center justify-center border" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-2">
                <label className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Amount Paid</label>
                <input type="number" value={logAmount} onChange={(e) => setLogAmount(e.target.value)} placeholder="0.00" className="w-full rounded-xl border px-3 py-2.5 outline-none" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </div>
              <div className="space-y-2">
                <label className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Date of Payment</label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                  <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="w-full rounded-xl border pl-9 pr-3 py-2.5 outline-none" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Payment Method</label>
                <div className="relative">
                  <select value={logMethod} onChange={(e) => setLogMethod(e.target.value)} className="w-full rounded-xl border px-3 py-2.5 outline-none appearance-none" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                    <option value="" disabled>Select a method</option>
                    {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                </div>
              </div>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-2">
              <button onClick={savePayment} className="px-5 py-2.5 rounded-xl text-white font-medium" style={{ background: "#3b82f6" }}>Save Payment</button>
              <button onClick={() => setShowLogModal(false)} className="px-5 py-2.5 rounded-xl border font-medium" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>Cancel</button>
            </div>
          </div>
        </div>,
        modalRoot,
      )}

      {showReminderModal && modalRoot && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>Send Payment Reminder</h3>
              <button onClick={() => setShowReminderModal(false)} className="w-9 h-9 rounded-lg inline-flex items-center justify-center border" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px]">
              <div className="p-4 border-r space-y-3" style={{ borderColor: "var(--border)" }}>
                <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>AI Draft Assistant</p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                        Add instructions for tone or content. Leave it empty and AI will draft the reminder for you.
                      </p>
                    </div>
                    <button
                      onClick={generateReminderWithAI}
                      disabled={generatingReminder || !currentUser}
                      className="px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60"
                      style={{ background: "#2563eb", color: "#fff" }}
                    >
                      {generatingReminder ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                      {generatingReminder ? "Generating..." : "Generate with AI"}
                    </button>
                  </div>
                  <textarea
                    value={reminderPrompt}
                    onChange={(e) => setReminderPrompt(e.target.value)}
                    rows={3}
                    placeholder="Example: Make it polite but firm, mention payment within 3 days, and keep it short."
                    className="w-full px-4 py-3 rounded-xl border outline-none resize-none"
                    style={{ color: "var(--text-primary)", background: "var(--bg-surface)", borderColor: "var(--border)" }}
                  />
                  {reminderError && (
                    <div className="text-xs rounded-lg px-3 py-2" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)" }}>
                      {reminderError}
                    </div>
                  )}
                </div>
                <textarea value={reminderMessage} onChange={(e) => setReminderMessage(e.target.value)} rows={12} className="w-full px-4 py-3 rounded-xl border outline-none resize-none" style={{ color: "var(--text-primary)", background: "var(--bg-elevated)", borderColor: "var(--border)" }} />
                <div className="flex justify-end gap-2">
                  <button onClick={sendNow} className="px-5 py-2.5 rounded-xl text-white font-medium" style={{ background: "#3b82f6" }}>Send Now</button>
                  <button onClick={() => setShowReminderModal(false)} className="px-5 py-2.5 rounded-xl border font-medium" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>Save as Draft</button>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <button onClick={() => setReminderChannel("whatsapp")} className="w-full rounded-xl border p-3 inline-flex items-center gap-2" style={{ borderColor: reminderChannel === "whatsapp" ? "#3b82f6" : "var(--border)", color: "var(--text-primary)" }}><MessageCircle size={16} />WhatsApp</button>
                <button onClick={() => setReminderChannel("email")} className="w-full rounded-xl border p-3 inline-flex items-center gap-2" style={{ borderColor: reminderChannel === "email" ? "#3b82f6" : "var(--border)", color: "var(--text-primary)" }}><Mail size={16} />Email</button>
                <button onClick={() => setReminderChannel("sms")} className="w-full rounded-xl border p-3 inline-flex items-center gap-2" style={{ borderColor: reminderChannel === "sms" ? "#3b82f6" : "var(--border)", color: "var(--text-primary)" }}><MessageSquare size={16} />SMS</button>
              </div>
            </div>
          </div>
        </div>,
        modalRoot,
      )}

      {showEditModal && modalRoot && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-3xl rounded-2xl border shadow-2xl p-6" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-4xl font-bold" style={{ color: "#1d4ed8" }}>Edit Debtor Profile</h3>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Update identification details and financial commitment notes for this ledger entry.</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="w-9 h-9 rounded-lg border inline-flex items-center justify-center" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <div className="space-y-2"><label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Debtor Name</label><input value={editDebtorName} onChange={(e) => setEditDebtorName(e.target.value)} className="w-full rounded-xl px-4 py-3 border outline-none" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }} /></div>
              <div className="space-y-2"><label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total Amount Due</label><input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="w-full rounded-xl px-4 py-3 border outline-none" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }} /></div>
              <div className="space-y-2"><label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Phone Number</label><div className="relative"><Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} /><input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full rounded-xl pl-8 pr-4 py-3 border outline-none" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }} /></div></div>
              <div className="space-y-2"><label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Email Address</label><div className="relative"><Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} /><input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full rounded-xl pl-8 pr-4 py-3 border outline-none" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }} /></div></div>
              <div className="md:col-span-2 space-y-2"><label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Description & Notes</label><textarea rows={4} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="w-full rounded-xl px-4 py-3 border outline-none resize-none" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }} /></div>
            </div>
            <div className="mt-5 p-3 rounded-xl border flex items-center gap-2 text-sm" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-muted)" }}><Info size={14} />Last edited by Admin on {new Date().toLocaleDateString()}</div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowEditModal(false)} className="px-5 py-2.5 rounded-xl font-medium" style={{ color: "var(--text-primary)" }}>Cancel</button>
              <button onClick={saveEdit} className="px-6 py-2.5 rounded-xl text-white font-semibold" style={{ background: "#1d4ed8" }}>Save Changes</button>
            </div>
          </div>
        </div>,
        modalRoot,
      )}

      {showDeleteConfirm && modalRoot && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-xl rounded-2xl border shadow-2xl px-7 py-6 text-center" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <div className="flex justify-center mb-3"><div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center"><TriangleAlert size={36} className="text-red-500" /></div></div>
            <h4 className="text-4xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Delete Debtor?</h4>
            <p className="text-xl leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>Are you sure you want to delete {debtor.debtorName} and all associated payment history? This action cannot be undone.</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-5 py-2.5 rounded-xl border font-medium" style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--bg-elevated)" }}>Cancel</button>
              <button onClick={confirmDelete} className="px-6 py-2.5 rounded-xl text-white font-semibold" style={{ background: "#dc2626" }}>Delete</button>
            </div>
          </div>
        </div>,
        modalRoot,
      )}
    </div>
  );
}
