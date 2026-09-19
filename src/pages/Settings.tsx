import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { useData } from "../context/DataContext";
import { User, Mail, Globe, Tag, Trash2, Plus, Bell, Clock, Info, Grid3x3 } from "lucide-react";

const avatarUrl = (style: string, seed: string) =>
  `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=128&backgroundColor=transparent`;

const PREDEFINED_AVATARS = [
  { name: "Lorelei Aaliyah", url: avatarUrl("lorelei", "Aaliyah") },
  { name: "Lorelei Mateo", url: avatarUrl("lorelei", "Mateo") },
  { name: "Lorelei Priya", url: avatarUrl("lorelei", "Priya") },
  { name: "Lorelei Zara", url: avatarUrl("lorelei", "Zara") },
  { name: "Lorelei Yara", url: avatarUrl("lorelei", "Yara") },
  { name: "Lorelei Omar", url: avatarUrl("lorelei", "Omar") },
  { name: "Lorelei Layla", url: avatarUrl("lorelei", "Layla") },
  { name: "Lorelei Karim", url: avatarUrl("lorelei", "Karim") },

  { name: "Lorelei Neutral Noor", url: avatarUrl("lorelei-neutral", "Noor") },
  { name: "Lorelei Neutral Sam", url: avatarUrl("lorelei-neutral", "Sam") },
  { name: "Lorelei Neutral Alex", url: avatarUrl("lorelei-neutral", "Alex") },
  { name: "Lorelei Neutral Dani", url: avatarUrl("lorelei-neutral", "Dani") },
  { name: "Lorelei Neutral Jules", url: avatarUrl("lorelei-neutral", "Jules") },
  { name: "Lorelei Neutral Rayan", url: avatarUrl("lorelei-neutral", "Rayan") },
  { name: "Lorelei Neutral Milan", url: avatarUrl("lorelei-neutral", "Milan") },
  { name: "Lorelei Neutral Sky", url: avatarUrl("lorelei-neutral", "Sky") },

  { name: "Notionists Amina", url: avatarUrl("notionists", "Amina") },
  { name: "Notionists Ravi", url: avatarUrl("notionists", "Ravi") },
  { name: "Notionists Leena", url: avatarUrl("notionists", "Leena") },
  { name: "Notionists Tariq", url: avatarUrl("notionists", "Tariq") },
  { name: "Notionists Inaya", url: avatarUrl("notionists", "Inaya") },
  { name: "Notionists Jonah", url: avatarUrl("notionists", "Jonah") },
  { name: "Notionists Maya", url: avatarUrl("notionists", "Maya") },
  { name: "Notionists Kabir", url: avatarUrl("notionists", "Kabir") },

  { name: "Notionists Neutral Ash", url: avatarUrl("notionists-neutral", "Ash") },
  { name: "Notionists Neutral Sage", url: avatarUrl("notionists-neutral", "Sage") },
  { name: "Notionists Neutral Avery", url: avatarUrl("notionists-neutral", "Avery") },
  { name: "Notionists Neutral Remy", url: avatarUrl("notionists-neutral", "Remy") },
  { name: "Notionists Neutral Taylor", url: avatarUrl("notionists-neutral", "Taylor") },
  { name: "Notionists Neutral Jordan", url: avatarUrl("notionists-neutral", "Jordan") },
  { name: "Notionists Neutral Noor", url: avatarUrl("notionists-neutral", "Noor") },
  { name: "Notionists Neutral Kai", url: avatarUrl("notionists-neutral", "Kai") },
];

export default function Settings() {
  const { currentUser, profileData, updateUserProfile } = useAuth();
  const { theme, setTheme, currency, setCurrency, timezone, setTimezone } = useApp();
  const { categories, addCategory, deleteCategory } = useData();
  const [activeTab, setActiveTab] = useState("profile");

  // Profile state
  const [name, setName] = useState(profileData?.name || currentUser?.displayName || "");
  const [bio, setBio] = useState(profileData?.bio || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: "", text: "" });

  const [newCategory, setNewCategory] = useState("");
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState("");

  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    inApp: true,
    earlyWarning: "3",
    paymentDay: "due",
  });

  const defaultNotifications = {
    email: true,
    push: false,
    inApp: true,
    earlyWarning: "3",
    paymentDay: "due",
  };

  const persistNotifications = async (next: typeof notifications) => {
    setNotifications(next);
    setSaveLoading(true);
    setSaveMessage({ type: "", text: "" });

    try {
      await updateUserProfile({
        name: name || profileData?.name || currentUser?.displayName || "",
        bio,
        photoURL: avatarPreview || currentUser?.photoURL || undefined,
        notifications: next,
      });
      setSaveMessage({ type: "success", text: "Notification settings saved." });
    } catch (err: any) {
      setSaveMessage({ type: "error", text: err.message || "Failed to save notification settings" });
    } finally {
      setSaveLoading(false);
    }
  };

  // Sync state when profile data loads
  React.useEffect(() => {
    if (profileData?.name && !name) setName(profileData.name);
    else if (currentUser?.displayName && !name) setName(currentUser.displayName);
    if (profileData?.bio && !bio) setBio(profileData.bio);

    if (profileData?.notifications) {
      setNotifications((prev) => ({
        ...prev,
        ...profileData.notifications,
      }));
    }
  }, [profileData, currentUser]);

  const handleAvatarSelect = (url: string) => {
    setAvatarPreview(url);
  };

  const handleSaveProfile = async () => {
    const timeoutId = setTimeout(() => {
      if (saveLoading) {
        setSaveLoading(false);
        setSaveMessage({ type: "error", text: "Update is taking longer than expected. Please check your internet connection." });
      }
    }, 15000); // 15 second timeout

    setSaveLoading(true);
    setSaveMessage({ type: "", text: "" });
    try {
      await updateUserProfile({
        name,
        bio,
        photoURL: avatarPreview || currentUser?.photoURL || undefined
      });

      clearTimeout(timeoutId);
      setAvatarPreview(null);
      setSaveMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("Settings: Profile save error:", err);
      setSaveMessage({ type: "error", text: err.message || "Failed to update profile" });
    } finally {
      setSaveLoading(false);
    }
  };

  const tabBtnClass = (tab: string) =>
    `w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium`;

  const tabBtnStyle = (tab: string): React.CSSProperties =>
    activeTab === tab
      ? { background: "var(--bg-muted)", color: "var(--accent)" }
      : { color: "var(--text-muted)" };

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    setCategoryLoading(true);
    setCategoryError("");
    try {
      await addCategory(newCategory.trim());
      setNewCategory("");
    } catch (err: any) {
      console.error(err);
      setCategoryError(err.message || "Failed to add category. Check your connection or try again.");
    } finally {
      setCategoryLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Manage your account and preferences
        </p>
      </div>

      <div
        className="rounded-2xl overflow-hidden shadow-xl flex flex-col md:flex-row min-h-[600px] border"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        {/* Sidebar */}
        <div
          className="w-full md:w-64 p-6 space-y-2 border-r"
          style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
        >
          {[
            { key: "profile", icon: User, label: "Profile" },
            { key: "preferences", icon: Globe, label: "Preferences" },
            { key: "categories", icon: Tag, label: "Categories" },
            { key: "notifications", icon: Bell, label: "Notifications" },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={tabBtnClass(key)}
              style={tabBtnStyle(key)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-8">
          {activeTab === "profile" && (
            <div className="space-y-8 animate-in fade-in">
              <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                Public Profile
              </h2>

              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-8">
                  <div className="relative">
                    <img
                      src={
                        avatarPreview ||
                        currentUser?.photoURL ||
                        `https://ui-avatars.com/api/?name=${currentUser?.email}&background=random`
                      }
                      alt="Profile"
                      className="w-32 h-32 rounded-3xl border-4 object-cover rotate-3 shadow-xl"
                      style={{ borderColor: "var(--accent)", background: "var(--bg-elevated)" }}
                    />
                    <div className="absolute -bottom-2 -right-2 bg-[var(--accent)] text-black font-bold px-3 py-1 rounded-lg text-[10px] shadow-lg uppercase tracking-tighter">
                      Current
                    </div>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Select Your Vibe</h3>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Curated from DiceBear Lorelei, Lorelei Neutral, Notionists, and Notionists Neutral.
                      </p>
                    </div>
                    <div
                      className="rounded-2xl border p-4"
                      style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                          Avatar Library
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {PREDEFINED_AVATARS.length} presets
                        </p>
                      </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                      {PREDEFINED_AVATARS.map((avatar) => (
                        <button
                          key={avatar.url}
                          type="button"
                          onClick={() => handleAvatarSelect(avatar.url)}
                          title={avatar.name}
                          className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.04] active:scale-[0.98] shadow-md ${(avatarPreview === avatar.url || (!avatarPreview && currentUser?.photoURL === avatar.url))
                            ? "border-[var(--accent)] scale-105 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                            : "border-[var(--border)] opacity-60 hover:opacity-100 hover:border-[var(--accent)]"
                            }`}
                          style={{ background: "linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)" }}
                        >
                          <img src={avatar.url} alt={avatar.name} className="w-full h-full object-contain p-2" />
                          <span
                            className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-[10px] font-semibold truncate"
                            style={{
                              color: "#fff",
                              background: "linear-gradient(180deg, transparent 0%, rgba(15,23,42,0.85) 100%)",
                            }}
                          >
                            {avatar.name}
                          </span>
                        </button>
                      ))}
                    </div>
                    </div>
                  </div>
                </div>
              </div>

              {saveMessage.text && (
                <div
                  className={`p-4 rounded-xl text-sm border ${saveMessage.type === "success"
                    ? "bg-green-500/10 border-green-500/50 text-green-500"
                    : "bg-red-500/10 border-red-500/50 text-red-500"
                    }`}
                >
                  {saveMessage.text}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl px-4 py-2.5 outline-none transition-all"
                    style={inputStyle}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5" style={{ color: "var(--text-muted)" }} />
                    </div>
                    <input
                      type="email"
                      defaultValue={currentUser?.email || ""}
                      disabled
                      className="w-full rounded-xl pl-10 pr-4 py-2.5 outline-none cursor-not-allowed"
                      style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                    />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    Bio
                  </label>
                  <textarea
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full rounded-xl px-4 py-2.5 outline-none transition-all resize-none"
                    style={inputStyle}
                    placeholder="Tell us a little bit about yourself"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <button
                  onClick={handleSaveProfile}
                  disabled={saveLoading}
                  className="px-6 py-2.5 rounded-xl text-sm font-medium transition-colors text-black disabled:opacity-50"
                  style={{ background: "var(--accent)" }}
                >
                  {saveLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "preferences" && (
            <div className="space-y-8 animate-in fade-in">
              <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                App Preferences
              </h2>

              <div className="space-y-6">
                <div className="flex items-center justify-between py-4 border-b" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <h3 className="font-medium" style={{ color: "var(--text-primary)" }}>Default Currency</h3>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Select the currency for your expenses
                    </p>
                  </div>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as any)}
                    className="rounded-xl px-4 py-2 outline-none transition-all appearance-none w-32"
                    style={inputStyle}
                  >
                    <option value="EUR">EUR (â‚¬)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (Â£)</option>
                    <option value="LKR">LKR (Rs.)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-4 border-b" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <h3 className="font-medium" style={{ color: "var(--text-primary)" }}>Time Zone</h3>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Your local time zone
                    </p>
                  </div>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="rounded-xl px-4 py-2 outline-none transition-all appearance-none w-64"
                    style={inputStyle}
                  >
                    <option value="UTC">UTC (GMT+0:00)</option>
                    <option value="IST">IST (UTC+5:30) Colombo, Sri Lanka</option>
                    <option value="EST">EST (UTC-5:00)</option>
                    <option value="PST">PST (UTC-8:00)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-4 border-b" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <h3 className="font-medium" style={{ color: "var(--text-primary)" }}>Theme</h3>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Customize the look of your workspace
                    </p>
                  </div>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as "dark" | "light")}
                    className="rounded-xl px-4 py-2 outline-none transition-all appearance-none w-32"
                    style={inputStyle}
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-4 border-b" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <h3 className="font-medium" style={{ color: "var(--text-primary)" }}>Date Format</h3>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      How dates should be displayed
                    </p>
                  </div>
                  <select
                    className="rounded-xl px-4 py-2 outline-none transition-all appearance-none w-40"
                    style={inputStyle}
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === "categories" && (
            <div className="space-y-8 animate-in fade-in">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  Expense Categories
                </h2>
              </div>

              <form onSubmit={handleAddCategory} className="flex gap-4">
                <input
                  type="text"
                  placeholder="Add new category (e.g. Travel, Software)"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 rounded-xl px-4 py-2.5 outline-none transition-all"
                  style={inputStyle}
                />
                <button
                  type="submit"
                  disabled={categoryLoading}
                  className="px-6 py-2.5 rounded-xl text-sm font-medium transition-colors text-black flex items-center space-x-2 disabled:opacity-50"
                  style={{ background: "var(--accent)" }}
                >
                  <Plus size={18} />
                  <span>Add</span>
                </button>
              </form>

              {categoryError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/50 text-red-500 text-sm">
                  {categoryError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3">
                {categories.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <p className="italic text-sm" style={{ color: "var(--text-muted)" }}>
                      No categories found. If you just signed up, they will appear in a moment.
                    </p>
                    <button
                      onClick={() => addCategory("Marketing")}
                      className="px-4 py-2 rounded-xl text-xs font-medium transition-colors border"
                      style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    >
                      Manually initialize (click if they don't appear)
                    </button>
                  </div>
                ) : (
                  categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-4 rounded-xl border transition-all hover:border-[var(--accent)] group"
                      style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
                    >
                      <div className="flex items-center space-x-3">
                        <Tag size={18} style={{ color: "var(--accent)" }} />
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                          {cat.name}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteCategory(cat.id)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="w-full space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  Notification Settings
                </h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Manage how and when you get alerted about your recurring expenses.
                </p>
              </div>

              <div
                className="rounded-2xl border px-4 py-5 sm:px-6 sm:py-6"
                style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <Bell size={16} className="text-blue-600" />
                  <h3 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                    Delivery Channels
                  </h3>
                </div>

                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  <label className="flex items-center justify-between gap-4 py-4">
                    <div className="flex items-center gap-3">
                      <Mail size={16} style={{ color: "var(--text-muted)" }} />
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        Email Notifications
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.email}
                      onChange={(e) => persistNotifications({ ...notifications, email: e.target.checked })}
                      className="h-4 w-4 accent-blue-600"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-4 py-4">
                    <div className="flex items-center gap-3">
                      <Bell size={16} style={{ color: "var(--text-muted)" }} />
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        Push Notifications
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.push}
                      onChange={(e) => persistNotifications({ ...notifications, push: e.target.checked })}
                      className="h-4 w-4 accent-blue-600"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-4 py-4">
                    <div className="flex items-center gap-3">
                      <Grid3x3 size={16} style={{ color: "var(--text-muted)" }} />
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        In-app Alerts
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.inApp}
                      onChange={(e) => persistNotifications({ ...notifications, inApp: e.target.checked })}
                      className="h-4 w-4 accent-blue-600"
                    />
                  </label>
                </div>

                <div className="mt-4 rounded-xl border px-3 py-3 text-xs leading-relaxed" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
                  In-app alerts are live and appear from the notification bell in the app.
                  Email and push preferences are saved, but delivery for those channels is not wired yet.
                </div>
              </div>

              <div
                className="rounded-2xl border px-4 py-5 sm:px-6 sm:py-6"
                style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2.5 mb-5">
                  <Clock size={16} className="text-blue-600" />
                  <h3 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                    Timing
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Early Warning
                    </p>
                    {[
                      { label: "3 days before", value: "3" },
                      { label: "1 day before", value: "1" },
                    ].map((option) => {
                      const selected = notifications.earlyWarning === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => persistNotifications({ ...notifications, earlyWarning: option.value })}
                          className="w-full rounded-xl border px-3 py-2.5 text-sm font-medium flex items-center gap-2"
                          style={{
                            borderColor: selected ? "#2563eb" : "var(--border)",
                            color: "var(--text-primary)",
                            background: "var(--bg-elevated)",
                          }}
                        >
                          <span
                            className="h-4 w-4 rounded-full border inline-block"
                            style={{
                              borderColor: selected ? "#2563eb" : "var(--border)",
                              background: selected ? "#2563eb" : "transparent",
                            }}
                          />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Payment Day
                    </p>
                    {[
                      { label: "On the due date", value: "due" },
                      { label: "After payment is processed", value: "processed" },
                    ].map((option) => {
                      const selected = notifications.paymentDay === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => persistNotifications({ ...notifications, paymentDay: option.value })}
                          className="w-full rounded-xl border px-3 py-2.5 text-sm font-medium flex items-center gap-2"
                          style={{
                            borderColor: selected ? "#2563eb" : "var(--border)",
                            color: "var(--text-primary)",
                            background: "var(--bg-elevated)",
                          }}
                        >
                          <span
                            className="h-4 w-4 rounded border inline-block"
                            style={{
                              borderColor: selected ? "#2563eb" : "var(--border)",
                              background: selected ? "#2563eb" : "transparent",
                            }}
                          />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t flex justify-end items-center gap-3" style={{ borderColor: "var(--border)" }}>
                  <button
                    onClick={() => {
                      const defaults = defaultNotifications;
                      persistNotifications(defaults);
                    }}
                    className="text-sm font-semibold px-4 py-2 rounded-xl border"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    Discard Changes
                  </button>
                  <button
                    onClick={async () => {
                      setSaveLoading(true);
                      setSaveMessage({ type: "", text: "" });
                      try {
                        await updateUserProfile({
                          name: name || profileData?.name || currentUser?.displayName || "",
                          bio,
                          photoURL: avatarPreview || currentUser?.photoURL || undefined,
                          notifications,
                        });
                        setSaveMessage({ type: "success", text: "Notification settings saved." });
                      } catch (err: any) {
                        setSaveMessage({ type: "error", text: err.message || "Failed to save notification settings" });
                      } finally {
                        setSaveLoading(false);
                      }
                    }}
                    className="px-6 py-2.5 rounded-xl text-sm font-medium transition-colors text-white"
                    style={{ background: "#2563eb" }}
                  >
                    {saveLoading ? "Saving..." : "Save Settings"}
                  </button>
                </div>
              </div>

              <div
                className="rounded-2xl p-5 border flex items-start gap-3"
                style={{ background: "rgba(37,99,235,0.10)", borderColor: "rgba(37,99,235,0.25)" }}
              >
                <div className="w-8 h-8 rounded-full bg-blue-600/15 flex items-center justify-center">
                  <Info size={14} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Pro Tip
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    In-app reminders now appear from the notification bell and follow your early warning preferences.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

