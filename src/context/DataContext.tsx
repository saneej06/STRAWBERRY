import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { fetchAllUserData, createRecord, updateRecord, deleteRecord } from "../services/dataService";

export type RecurringFrequency = "Weekly" | "Monthly" | "Yearly";
export type RecurringStatus = "active" | "paused";
export interface Expense { id: string; userId: string; amount: number; category: string; description: string; date: string; receiptUrl?: string; splitWith?: string; createdAt?: any; subject: string; merchant: string; currency: string; reimbursable: boolean; employee: string; addToReport: boolean; tags: string[]; isRecurring: boolean; frequency?: RecurringFrequency | ""; endDate?: string; recurringStatus?: RecurringStatus; recurringNotifications?: boolean; icon?: string; paymentMethod?: "" | "credit_card" | "debit_card" | "bank_transfer" | "cash" | "cheque"; }
export interface Debtor { id: string; userId: string; debtorName: string; phoneNumber?: string; email?: string; amount: number; paidAmount: number; expenseId?: string; notes?: string; status: "pending" | "paid"; date: string; createdAt?: any; paidAt?: any; }
export interface Payment { id: string; debtorId: string; debtorName: string; amount: number; date: string; method?: string; userId: string; createdAt: any; }
export interface Category { id: string; name: string; userId: string; createdAt?: any; }
interface DataContextType {
  expenses: Expense[]; debtors: Debtor[]; categories: Category[]; payments: Payment[];
  addExpense: (expense: Omit<Expense, "id">) => Promise<void>;
  addDebtor: (debtor: Omit<Debtor, "id" | "userId">) => Promise<void>;
  updateDebtor: (id: string, debtor: Partial<Debtor>) => Promise<void>;
  markDebtorPaid: (id: string) => Promise<void>;
  recordDebtorPayment: (id: string, amount: number, method?: string, date?: string) => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  deleteDebtor: (id: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  updateExpense: (id: string, expense: Partial<Expense>) => Promise<void>;
  sendFeedback: (data: { name: string; email: string; message: string }) => Promise<void>;
  loading: boolean;
}
const DataContext = createContext<DataContextType | undefined>(undefined);
const camelToSnake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const mapExpense = (item: any): Expense => ({
  ...item,
  userId: item.user_id,
  receiptUrl: item.receipt_url,
  splitWith: item.split_with,
  createdAt: item.created_at,
  addToReport: item.add_to_report,
  isRecurring: item.is_recurring,
  endDate: item.end_date,
  recurringStatus: item.recurring_status,
  recurringNotifications: item.recurring_notifications,
  paymentMethod: item.payment_method,
});
const mapDebtor = (item: any): Debtor => ({
  ...item,
  userId: item.user_id,
  debtorName: item.debtor_name,
  phoneNumber: item.phone_number,
  paidAmount: item.paid_amount,
  expenseId: item.expense_id,
  createdAt: item.created_at,
  paidAt: item.paid_at,
});
const mapPayment = (item: any): Payment => ({
  ...item,
  userId: item.user_id,
  debtorId: item.debtor_id,
  debtorName: item.debtor_name,
  createdAt: item.created_at,
});
const mapCategory = (item: any): Category => ({
  ...item,
  userId: item.user_id,
  createdAt: item.created_at,
});

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const loadCountRef = useRef(0);

  const load = useCallback(async () => {
    if (!currentUser) {
      setExpenses([]);
      setDebtors([]);
      setCategories([]);
      setPayments([]);
      setLoading(false);
      return;
    }
    loadCountRef.current++;
    setLoading(true);
    try {
      const data = await fetchAllUserData();
      setExpenses((data.expenses || []).map(mapExpense));
      setDebtors((data.debtors || []).map(mapDebtor));
      setCategories((data.categories || []).map(mapCategory));
      setPayments((data.payments || []).map(mapPayment));
    } catch (error) {
      console.error("Data load error:", error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!currentUser) return;
    const pollInterval = window.setInterval(() => { void load(); }, 45000);
    return () => window.clearInterval(pollInterval);
  }, [currentUser?.id, load]);

  const uid = () => {
    if (!currentUser) throw new Error("No user logged in");
    return currentUser.id;
  };

  const insert = async (table: string, data: Record<string, unknown>) => {
    await createRecord(table, data);
    await load();
  };
  const update = async (table: string, id: string, data: Record<string, unknown>) => {
    await updateRecord(table, id, data);
    await load();
  };
  const remove = async (table: string, id: string) => {
    await deleteRecord(table, id);
    await load();
  };

  const addExpense = async (expense: Omit<Expense, "id" | "userId">) =>
    insert("expenses", { ...Object.fromEntries(Object.entries(expense).map(([key, value]) => [camelToSnake(key), value])), user_id: uid() });
  const addDebtor = async (debtor: Omit<Debtor, "id" | "userId">) =>
    insert("debtors", { ...Object.fromEntries(Object.entries(debtor).map(([key, value]) => [camelToSnake(key), value])), paid_amount: 0, status: "pending", user_id: uid() });
  const addCategory = async (name: string) => insert("categories", { name, user_id: uid() });
  const deleteCategory = (id: string) => remove("categories", id);
  const deleteExpense = (id: string) => remove("expenses", id);
  const deleteDebtor = (id: string) => remove("debtors", id);
  const updateExpense = (id: string, value: Partial<Expense>) =>
    update("expenses", id, Object.fromEntries(Object.entries(value).map(([key, item]) => [camelToSnake(key), item])));
  const updateDebtor = (id: string, value: Partial<Debtor>) =>
    update("debtors", id, Object.fromEntries(Object.entries(value).map(([key, item]) => [camelToSnake(key), item])));

  const recordDebtorPayment = async (id: string, amount: number, method = "cash", date = new Date().toISOString().split("T")[0]) => {
    const debtor = debtors.find((item) => item.id === id);
    if (!debtor || debtor.userId !== uid()) throw new Error("Unauthorized debtor payment attempt.");
    const paid = Number(debtor.paidAmount || 0) + Number(amount);
    if (!Number.isFinite(amount) || amount <= 0 || paid > Number(debtor.amount)) throw new Error("Invalid payment amount.");
    await update("debtors", id, {
      paid_amount: paid,
      status: paid >= debtor.amount ? "paid" : "pending",
      paid_at: paid >= debtor.amount ? new Date().toISOString() : null,
    });
    await insert("payments", { debtor_id: id, debtor_name: debtor.debtorName, amount, date, method, user_id: uid() });
  };

  const markDebtorPaid = async (id: string) => {
    const debtor = debtors.find((item) => item.id === id);
    if (!debtor) throw new Error("Debtor not found");
    return recordDebtorPayment(id, Number(debtor.amount) - Number(debtor.paidAmount || 0), "Full Settlement");
  };

  const sendFeedback = (data: { name: string; email: string; message: string }) =>
    insert("feedback", { ...data, user_id: uid() });

  return (
    <DataContext.Provider
      value={{
        expenses, debtors, categories, payments,
        addExpense, addDebtor, updateDebtor, markDebtorPaid, recordDebtorPayment,
        addCategory, deleteCategory, deleteDebtor, deleteExpense, updateExpense,
        sendFeedback, loading,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within a DataProvider");
  return context;
}