import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import NotificationCenter from "./NotificationCenter";
import {
  Home,
  CreditCard,
  Settings,
  LogOut,
  Users,
  History,
  Calendar as CalendarIcon,
  Repeat2,
  Bot,
  Menu,
  X,
  Sun,
  Moon,
  Info,
  LifeBuoy,
  MessageCircle,
  FileText,
  Sparkles,
} from "lucide-react";

export default function Layout() {
  const { currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useApp();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isDark = theme === "dark";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/expenses", icon: CreditCard, label: "Expenses" },
    { to: "/debtors", icon: Users, label: "Debtors" },
    { to: "/history", icon: History, label: "History" },
    { to: "/calendar", icon: CalendarIcon, label: "Calendar" },
    { to: "/recurring", icon: Repeat2, label: "Recurring" },
    { to: "/ai-assistant", icon: Bot, label: "AI Assistant" },
    { to: "/reports", icon: FileText, label: "Reports" },
    { to: "/settings", icon: Settings, label: "Settings" },
    { to: "/about", icon: Info, label: "About Us" },
    { to: "/contact", icon: LifeBuoy, label: "Contact" },
    { to: "/feedback", icon: MessageCircle, label: "Feedback" },
  ];

  return (
    <div
      className="flex h-screen font-sans overflow-hidden transition-colors duration-300"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Mobile Header */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 h-16 z-50 flex items-center justify-between px-4 border-b backdrop-blur-xl transition-colors duration-300"
        style={{ background: "color-mix(in srgb, var(--bg-surface) 88%, transparent)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl text-sm font-black" style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>
            S
          </div>
          <span className="font-black text-lg" style={{ color: "var(--text-primary)" }}>
            STRAWBERRY
          </span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl transition-colors"
            style={{ color: "var(--text-secondary)" }}
            title="Toggle theme"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ color: "var(--text-secondary)" }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40 w-72 flex flex-col justify-between border-r transform transition-all duration-300 ease-in-out
          ${mobileMenuOpen ? "translate-x-0 pt-16" : "-translate-x-full md:translate-x-0"}
        `}
        style={{
          background: "linear-gradient(180deg, var(--bg-surface), color-mix(in srgb, var(--bg-surface) 88%, var(--bg-base)))",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <div className="overflow-y-auto flex-1">
          <div className="px-6 pt-7 pb-4 hidden md:block">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl text-lg font-black shadow-lg" style={{ background: "linear-gradient(135deg, var(--accent), #38bdf8)", color: "var(--accent-contrast)" }}>
                S
              </div>
              <div>
                <p className="text-xl font-black leading-none" style={{ color: "var(--text-primary)" }}>
                  STRAWBERRY
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
                  Finance Studio
                </p>
              </div>
            </div>
          </div>

          {/* User Profile */}
          <div className="mx-4 mt-3 mb-4 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-base)" }}>
            <div className="flex items-center gap-3">
            <img
              src={
                currentUser?.photoURL ||
                `https://ui-avatars.com/api/?name=${currentUser?.email}&background=random`
              }
              alt="Profile"
              className="h-12 w-12 rounded-2xl object-cover border-2"
              style={{ borderColor: "var(--accent)" }}
            />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  {currentUser?.displayName ||
                    currentUser?.email?.split("@")[0] ||
                    "User"}
                </h2>
                <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                  {currentUser?.email || "Welcome back"}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="px-4 space-y-1.5 pb-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `group relative flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all text-sm font-semibold ${isActive ? "active-nav-item" : "inactive-nav-item hover:translate-x-1"
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                      background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, var(--bg-elevated)), var(--bg-elevated))",
                      color: "var(--accent)",
                      border: "1px solid var(--border)",
                      boxShadow: "var(--shadow-card)",
                    }
                    : {
                      color: "var(--text-muted)",
                    }
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute left-2 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-[var(--accent)]" />}
                <item.icon size={20} />
                <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Bottom Section */}
        <div
          className="p-4 border-t transition-colors duration-300"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
        >
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-3 w-full rounded-2xl transition-colors text-sm font-semibold"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            }}
          >
            <LogOut size={20} />
            <span>Log out</span>
          </button>

          <div className="mt-4 mb-2 hidden md:flex items-center justify-between rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--bg-base)" }}>
            <div className="flex items-center gap-2">
              <Sparkles size={16} style={{ color: "var(--accent)" }} />
              <span className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                Studio Mode
              </span>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-all duration-300 hover:scale-105"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--accent)",
                border: "1px solid var(--border)",
              }}
              title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main
        className="flex-1 overflow-y-auto p-4 md:p-8 pt-20 md:pt-6 w-full transition-colors duration-300"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, transparent), transparent 24%), var(--bg-base)",
        }}
      >
        <div className="mb-6 hidden items-center justify-between md:flex">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>
              STRAWBERRY
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              Track, recover, report, and decide with clarity.
            </p>
          </div>
          <NotificationCenter />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
