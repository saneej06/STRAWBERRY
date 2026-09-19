import React, { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useData } from "../context/DataContext";
import { useApp } from "../context/AppContext";
import { 
  ChevronLeft, 
  Edit3, 
  Pause, 
  Trash2, 
  Calendar, 
  Tag as TagIcon, 
  Download, 
  ExternalLink,
  Play,
  TrendingUp,
  FileText,
  DollarSign,
  Briefcase,
  Monitor,
  ShoppingBag,
  RefreshCw,
  X,
  Plus,
  Check,
  Image as ImageIcon
} from "lucide-react";
import * as Icons from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "../utils/format";
import { getRecurringStatus } from "../utils/recurring";

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { expenses, deleteExpense, updateExpense, categories } = useData();
  const { currency: preferredCurrency, theme } = useApp();

  const expense = expenses.find(e => e.id === id);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  const [tagInput, setTagInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const paymentMethodLabel = (method?: string) => {
    switch (method) {
      case "credit_card":
        return "💳 Credit Card";
      case "debit_card":
        return "🏧 Debit Card";
      case "bank_transfer":
        return "🏦 Bank Transfer";
      case "cash":
        return "💵 Cash";
      case "cheque":
        return "📝 Cheque";
      default:
        return "Not set";
    }
  };

  useEffect(() => {
    if (expense && !formData) {
      setFormData({
        subject: expense.subject,
        amount: expense.amount,
        category: expense.category,
        date: expense.date,
        merchant: expense.merchant,
        description: expense.description,
        tags: expense.tags || [],
        currency: expense.currency,
        icon: expense.icon || "",
        paymentMethod: expense.paymentMethod || "",
      });
    }
  }, [expense, formData]);

  const currencySymbols: Record<string, string> = {
    USD: "$",
    LKR: "Rs.",
    EUR: "€",
    GBP: "£",
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    "Streaming": <Monitor size={24} />,
    "Entertainment": <Play size={24} />,
    "Shopping": <ShoppingBag size={24} />,
    "Marketing": <TrendingUp size={24} />,
    "Groceries": <ShoppingBag size={24} />,
    "Work": <Briefcase size={24} />,
    "Utilities": <RefreshCw size={24} />,
  };

  const paymentHistory = useMemo(() => {
    if (!expense) return [];
    return expenses
      .filter(e => e.merchant === expense.merchant && e.subject === expense.subject)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expense, expenses]);

  const totalSpentThisYear = useMemo(() => {
    if (!expense) return 0;
    const currentYear = new Date().getFullYear();
    return expenses
      .filter(e => e.merchant === expense.merchant && new Date(e.date).getFullYear() === currentYear)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expense, expenses]);

  const handleDownloadAll = () => {
    if (!expense || paymentHistory.length === 0) return;
    
    const doc = new jsPDF();
    const accentColor: [number, number, number] = [0, 188, 212];
    const darkColor: [number, number, number] = [30, 30, 35];
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(...darkColor);
    doc.rect(0, 0, pageWidth, 40, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(...accentColor);
    doc.text("STRAWBERRY", 14, 25);
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.text(`Payment History: ${expense.subject}`, 14, 34);

    // Table
    autoTable(doc, {
      startY: 50,
      head: [["Date", "Merchant", "Category", "Amount", "Status"]],
      body: paymentHistory.map(item => [
        format(new Date(item.date), "MMM d, yyyy"),
        item.merchant,
        item.category,
        formatCurrency(item.amount, item.currency),
        "PAID"
      ]),
      headStyles: { fillColor: accentColor, textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 252, 253] },
    });

    doc.save(`${expense.subject.replace(/\s+/g, "_")}_History.pdf`);
  };

  const handleDownloadSingle = (item: any) => {
    const doc = new jsPDF();
    const accentColor: [number, number, number] = [37, 99, 235]; // Blue 600
    const pageWidth = doc.internal.pageSize.getWidth();

    // Receipt Frame
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.5);
    doc.rect(10, 10, pageWidth - 20, 120);

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...accentColor);
    doc.text("EXPENSE RECEIPT", pageWidth / 2, 25, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("STRAWBERRY Financial Services", pageWidth / 2, 32, { align: "center" });

    // Dividers
    doc.setDrawColor(240, 240, 240);
    doc.line(20, 40, pageWidth - 20, 40);

    // Details Grid
    const leftCol = 25;
    const rightCol = pageWidth - 25;
    let y = 55;

    const addRow = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(50, 50, 50);
      doc.text(label, leftCol, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(value, rightCol, y, { align: "right" });
      y += 12;
    };

    addRow("Subject:", item.subject);
    addRow("Merchant:", item.merchant);
    addRow("Category:", item.category);
    addRow("Payment Method:", paymentMethodLabel(item.paymentMethod));
    addRow("Date:", format(new Date(item.date), "MMMM d, yyyy"));
    
    doc.line(20, y - 5, pageWidth - 20, y - 5);
    y += 5;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...accentColor);
    doc.text("Total Amount:", leftCol, y);
    doc.text(formatCurrency(item.amount, item.currency), rightCol, y, { align: "right" });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Transaction ID: ${item.id}`, pageWidth / 2, 120, { align: "center" });

    doc.save(`Receipt_${item.subject.replace(/\s+/g, "_")}_${item.date}.pdf`);
  };

  if (!expense || !formData) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Expense not found</h2>
        <button 
          onClick={() => navigate("/history")}
          className="flex items-center gap-2 text-blue-600 font-semibold hover:underline"
        >
          <ChevronLeft size={20} /> Back to History
        </button>
      </div>
    );
  }

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this expense?")) {
      await deleteExpense(expense.id);
      navigate("/history");
    }
  };

  const handleToggleRecurringStatus = async () => {
    if (!expense.isRecurring) return;
    const nextStatus = getRecurringStatus(expense) === "paused" ? "active" : "paused";
    await updateExpense(expense.id, { recurringStatus: nextStatus });
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      await updateExpense(expense.id, {
        ...formData,
        amount: Number(formData.amount)
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update expense:", err);
      alert("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t: string) => t !== tagToRemove) });
  };

  const symbol = currencySymbols[formData.currency] || "$";
  const isDark = theme === "dark";

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm mb-8" style={{ color: "var(--text-muted)" }}>
        <Link to="/history" className="hover:text-blue-600 transition-colors">Expenses</Link>
        <ChevronLeft size={14} className="rotate-180" />
        <Link to={`/expenses/${expense.id}`} className="hover:text-blue-600 transition-colors" onClick={() => setIsEditing(false)}>{expense.subject}</Link>
        {isEditing && (
          <>
            <ChevronLeft size={14} className="rotate-180" />
            <span style={{ color: "var(--text-primary)" }}>Edit</span>
          </>
        )}
      </div>

      {/* Header Card */}
      <div 
        className="rounded-3xl p-8 border mb-8 flex flex-wrap items-center justify-between gap-6 shadow-sm"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-6 flex-1">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center shadow-inner shrink-0">
            {expense.icon ? (
              React.createElement(Icons[expense.icon as keyof typeof Icons] || DollarSign, { size: 32 })
            ) : (
              categoryIcons[formData.category] || <DollarSign size={32} />
            )}
          </div>
          <div className="flex-1">
            {isEditing ? (
              <div className="max-w-md">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-60">Expense Name</p>
                <input 
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full text-2xl font-extrabold bg-transparent border-b-2 border-blue-500/30 focus:border-blue-500 outline-none transition-all py-1 px-0"
                  style={{ color: "var(--text-primary)" }}
                  placeholder="Enter expense name..."
                />
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-extrabold mb-1" style={{ color: "var(--text-primary)" }}>{expense.subject}</h1>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                    expense.recurringStatus === "paused"
                      ? "bg-amber-50 text-amber-600 border-amber-100"
                      : "bg-green-50 text-green-600 border-green-100"
                  }`}>
                    {expense.recurringStatus === "paused" ? "Paused" : "Active"}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
                    <RefreshCw size={14} />
                    {expense.isRecurring ? `${expense.frequency} Recurring` : "One-time Expense"}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button 
                onClick={() => setIsEditing(false)}
                className="px-6 py-3 rounded-xl font-bold text-sm bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-all"
                style={{ background: "var(--bg-muted)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="px-8 py-3 rounded-xl font-bold text-sm bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} />}
                Save Changes
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-all" 
                style={{ background: "var(--bg-muted)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                <Edit3 size={18} /> Edit
              </button>
              {expense.isRecurring && (
                <button
                  onClick={handleToggleRecurringStatus}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-all"
                  style={{ background: "var(--bg-muted)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  {expense.recurringStatus === "paused" ? <Play size={18} /> : <Pause size={18} />}
                  {expense.recurringStatus === "paused" ? "Resume" : "Pause"}
                </button>
              )}
              <button 
                onClick={handleDelete}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-all"
              >
                <Trash2 size={18} /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        {[
          { 
            label: "Amount", 
            value: isEditing ? (
              <div className="flex items-center">
                <span className="mr-1 text-blue-500 font-bold">{symbol}</span>
                <input 
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full bg-transparent font-extrabold outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
            ) : `${symbol}${expense.amount.toFixed(2)}`, 
            sub: `${formData.currency} per month` 
          },
          { 
            label: "Category", 
            value: isEditing ? (
              <select 
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-transparent font-extrabold outline-none cursor-pointer appearance-none"
                style={{ color: "var(--text-primary)" }}
              >
                {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
              </select>
            ) : formData.category, 
            sub: "Entertainment" 
          },
          { 
            label: "Next Billing", 
            value: isEditing ? (
              <input 
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-transparent font-extrabold outline-none text-sm"
                style={{ color: "var(--text-primary)" }}
              />
            ) : format(new Date(formData.date), "MM/dd/yyyy"), 
            sub: expense.isRecurring ? "Monthly Cycle" : "One-time" 
          },
          { 
            label: "Merchant", 
            value: isEditing ? (
              <input 
                type="text"
                value={formData.merchant}
                onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                className="w-full bg-transparent font-extrabold outline-none"
                style={{ color: "var(--text-primary)" }}
                placeholder="Merchant name..."
              />
            ) : formData.merchant, 
            sub: "Verified Merchant" 
          },
          {
            label: "Payment Method",
            value: isEditing ? (
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full bg-transparent font-extrabold outline-none cursor-pointer appearance-none"
                style={{ color: "var(--text-primary)" }}
              >
                <option value="">Select payment method</option>
                <option value="credit_card">💳 Credit Card</option>
                <option value="debit_card">🏧 Debit Card</option>
                <option value="bank_transfer">🏦 Bank Transfer</option>
                <option value="cash">💵 Cash</option>
                <option value="cheque">📝 Cheque</option>
              </select>
            ) : paymentMethodLabel(formData.paymentMethod),
            sub: "Used for this transaction"
          },
        ].map((stat, i) => (
          <div 
            key={i}
            className={`rounded-2xl p-6 border shadow-sm transition-all ${isEditing ? 'ring-2 ring-blue-500/10 border-blue-500/20' : ''}`}
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>{stat.label}</p>
            <div className="text-xl font-extrabold mb-1" style={{ color: "var(--text-primary)" }}>{stat.value}</div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Description & Tags */}
          <div 
            className="rounded-3xl p-8 border shadow-sm"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>Description & Details</h3>
            {isEditing ? (
              <textarea 
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full min-h-[120px] p-4 rounded-xl bg-gray-50/50 border border-gray-100 focus:border-blue-500 outline-none transition-all text-sm mb-6 resize-none"
                style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                placeholder="Premium Ultra HD plan for 4 screens. Billed monthly..."
              />
            ) : (
              <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-muted)" }}>
                {expense.description || "No description provided for this expense. You can add more details by editing the expense."}
              </p>
            )}

            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Tags</p>
              <div className="flex flex-wrap gap-2 items-center">
                {formData.tags?.map((tag: string) => (
                  <span 
                    key={tag} 
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold border border-blue-100 flex items-center gap-1.5"
                  >
                    # {tag}
                    {isEditing && (
                      <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </span>
                ))}
                
                {isEditing && (
                  <div className="flex items-center gap-2">
                    <input 
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      placeholder="New tag..."
                      className="bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none text-xs py-1 w-24"
                    />
                    <button 
                      onClick={handleAddTag}
                      className="p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 transition-all"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}

                {!isEditing && formData.tags.length === 0 && (
                   <span className="text-xs italic opacity-40">No tags added</span>
                )}
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div 
            className="rounded-3xl border overflow-hidden shadow-sm opacity-90 grayscale-[0.2]"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
          >
            <div className="p-8 pb-4 flex justify-between items-center border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Payment History</h3>
                {isEditing && <span className="text-[10px] italic opacity-50">History cannot be edited</span>}
              </div>
              <button 
                onClick={handleDownloadAll}
                className="text-sm font-bold text-blue-600 hover:underline"
              >
                Download All
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="uppercase text-[10px] font-bold tracking-widest" style={{ color: "var(--text-muted)" }}>
                    <th className="px-8 py-4">Date</th>
                    <th className="px-8 py-4">Amount</th>
                    <th className="px-8 py-4">Status</th>
                    <th className="px-8 py-4 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100" style={{ borderColor: "var(--border)" }}>
                  {paymentHistory.map((item, i) => (
                    <tr key={i} className="group hover:bg-gray-50/50 transition-colors" style={{ background: i % 2 === 0 ? "transparent" : "var(--bg-muted)" }}>
                      <td className="px-8 py-4 font-medium" style={{ color: "var(--text-primary)" }}>{format(new Date(item.date), "MMM d, yyyy")}</td>
                      <td className="px-8 py-4 font-bold" style={{ color: "var(--text-primary)" }}>{symbol}{item.amount.toFixed(2)}</td>
                      <td className="px-8 py-4">
                        <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-md text-[10px] font-bold uppercase tracking-tight border border-green-100">Paid</span>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <button 
                          onClick={() => handleDownloadSingle(item)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Download size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paymentHistory.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-8 py-8 text-center" style={{ color: "var(--text-muted)" }}>No transaction history found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-gray-50/30 text-center border-t border-gray-100" style={{ background: "var(--bg-muted)", borderColor: "var(--border)" }}>
              <button 
                onClick={() => navigate("/history")}
                className="text-xs font-bold" 
                style={{ color: "var(--text-primary)" }}
              >
                View All History
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Receipt Preview */}
          <div 
            className="rounded-3xl p-8 border shadow-sm"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
          >
            <h3 className="text-lg font-bold mb-6" style={{ color: "var(--text-primary)" }}>Receipt Attached</h3>
            <div 
              className="aspect-[3/4] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-6 mb-6 group transition-all"
              style={{ background: "var(--bg-muted)", borderColor: "var(--border)" }}
            >
              <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText size={32} />
              </div>
              <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>RECEIPT_PREVIEW.PDF</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Attached on {format(new Date(formData.date), "MMM d")}</p>
            </div>
            <div className="space-y-3">
              <button className="w-full py-3 rounded-xl bg-blue-50 text-blue-600 text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-all border border-blue-100">
                <RefreshCw size={16} /> {isEditing ? "Change Receipt" : "Replace Receipt"}
              </button>
              {isEditing && (
                <button className="w-full py-3 rounded-xl bg-red-50 text-red-600 text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all border border-red-100">
                  <Trash2 size={16} /> Remove Receipt
                </button>
              )}
            </div>
          </div>

          {/* Insights Widget */}
          <div 
            className="rounded-3xl p-8 bg-blue-600 text-white relative overflow-hidden shadow-lg shadow-blue-500/20 group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              <TrendingUp size={80} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-4 opacity-80">Spending Insight</p>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/20">
                <TrendingUp size={24} />
              </div>
              <div>
                <h4 className="text-2xl font-bold">{symbol}{totalSpentThisYear.toFixed(2)}</h4>
                <p className="text-[10px] opacity-70">Total spent this year</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed italic opacity-80">
              "*This subscription accounts for approximately {((totalSpentThisYear / 5000) * 100).toFixed(0)}% of your estimated annual budget.*"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
