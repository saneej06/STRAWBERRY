import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import {
  api,
  getAuthToken,
  getStoredUserData,
  storeAuthTokens,
  clearAuthTokens,
} from "../services/api";
import { fetchProfile } from "../services/dataService";

export type AppUser = {
  id: string;
  uid: string;
  email?: string;
  name?: string;
  displayName?: string;
  photoURL?: string;
  user_metadata?: any;
};

type Notifications = { email?: boolean; push?: boolean; inApp?: boolean; earlyWarning?: string; paymentDay?: string };

interface AuthContextType {
  currentUser: AppUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<{ message: string; verificationUrl?: string }>;
  resetPassword: (email: string) => Promise<{ message: string; devResetUrl?: string }>;
  confirmPasswordReset: (token: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: {
    name: string;
    bio?: string;
    photoURL?: string;
    avatarFile?: File;
    notifications?: Notifications;
  }) => Promise<void>;
  profileData: any;
  isMock: boolean;
  handleOAuthRedirect: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const defaultNotifications = { email: true, push: false, inApp: true, earlyWarning: "3", paymentDay: "due" };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const profileCache = useRef<Record<string, any>>({});

  const mapUser = (raw: any): AppUser => ({
    id: raw.id,
    uid: raw.id,
    email: raw.email,
    name: raw.name || raw.displayName || raw.email?.split("@")[0] || "User",
    displayName: raw.displayName || raw.name || raw.email?.split("@")[0] || "User",
    photoURL: raw.photoURL || raw.photo_url || null,
    user_metadata: raw,
  });

  const syncProfile = useCallback(async (userId: string) => {
    try {
      if (profileCache.current[userId]) {
        setProfileData({ ...profileCache.current[userId], photoURL: profileCache.current[userId]?.photo_url });
        return;
      }
      const res = await fetchProfile();
      const prof = res?.profile;
      if (prof) {
        profileCache.current[userId] = prof;
        setProfileData({ ...prof, photoURL: prof.photo_url });
      } else {
        setProfileData(null);
      }
    } catch (err) {
      console.error("Failed to sync profile:", err);
    }
  }, []);

  const restoreSession = useCallback(async () => {
    const token = getAuthToken();
    const storedUser = getStoredUserData();
    if (!token || !storedUser) {
      setCurrentUser(null);
      setProfileData(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<any>("/api/user");
      const mapped = mapUser(res?.user || storedUser);
      setCurrentUser(mapped);
      await syncProfile(mapped.id);
    } catch {
      clearAuthTokens();
      setCurrentUser(null);
      setProfileData(null);
    } finally {
      setLoading(false);
    }
  }, [syncProfile]);

  const handleOAuthRedirect = useCallback(async (): Promise<boolean> => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return false;

    const params = new URLSearchParams(hash);
    const token = params.get("token");
    const errorParam = params.get("error");

    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);

    if (errorParam) throw new Error(decodeURIComponent(errorParam).replace(/\+/g, " "));
    if (token) {
      storeAuthTokens(token, {});
      const res = await api.get<any>("/api/user");
      const mapped = mapUser(res?.user || {});
      storeAuthTokens(token, res?.user || {});
      setCurrentUser(mapped);
      await syncProfile(mapped.id);
      return true;
    }
    return false;
  }, [syncProfile]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const login = async (email: string, password: string) => {
    const res = await api.post<any>("/api/user", { email, password });
    if (res?.token) {
      storeAuthTokens(res.token, res.user);
      const mapped = mapUser(res.user);
      setCurrentUser(mapped);
      await syncProfile(mapped.id);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await api.post<any>("/api/auth", { name, email, password });
    return {
      message: res?.message || "Account created successfully.",
      verificationUrl: res?.verificationUrl || undefined,
    };
  };

  const resetPassword = async (email: string) => {
    const res = await api.post<any>("/api/password-reset", { email });
    return {
      message: res?.message || "If an account exists, a reset link has been sent.",
      devResetUrl: res?.devResetUrl,
    };
  };

  const confirmPasswordReset = async (token: string, password: string) => {
    await api.patch<any>("/api/password-reset", { token, password });
  };

  const loginWithGoogle = async () => {
    const configRes = await api.get<{ configured: boolean }>("/api/auth-google-config");
    if (!configRes?.configured) {
      throw new Error(
        "Google Login is not configured yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables to enable it."
      );
    }
    window.location.href = "/api/auth-google";
  };

  const logout = async () => {
    clearAuthTokens();
    setCurrentUser(null);
    setProfileData(null);
    profileCache.current = {};
    api.del("/api/user").catch(() => {});
  };

  const updateUserProfile = async ({
    name,
    bio,
    photoURL,
    avatarFile,
    notifications,
  }: {
    name: string;
    bio?: string;
    photoURL?: string;
    avatarFile?: File;
    notifications?: Notifications;
  }) => {
    if (!currentUser) throw new Error("No user logged in");

    let finalPhotoURL = photoURL || currentUser.photoURL || null;
    if (avatarFile) {
      if (!avatarFile.type.startsWith("image/")) throw new Error("Only image uploads are allowed.");
      if (avatarFile.size > 5 * 1024 * 1024) throw new Error("Avatar uploads must be 5 MB or smaller.");
      finalPhotoURL = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(avatarFile);
      });
    }

    const patchData: Record<string, any> = {
      name,
      bio: bio || "",
      photo_url: finalPhotoURL || null,
    };
    if (notifications) patchData.notifications = notifications;

    const res = await api.patch<any>("/api/user", patchData);
    const prof = res?.profile;
    if (prof) {
      profileCache.current[currentUser.id] = prof;
      setProfileData({ ...prof, photoURL: prof.photo_url });
    }

    const stored = getStoredUserData() || {};
    const updatedStored = { ...stored, name, displayName: name, photoURL: finalPhotoURL };
    storeAuthTokens(getAuthToken()!, updatedStored);
    setCurrentUser((prev) => (prev ? { ...prev, name, displayName: name, photoURL: finalPhotoURL } : prev));
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        login,
        register,
        resetPassword,
        confirmPasswordReset,
        loginWithGoogle,
        logout,
        updateUserProfile,
        profileData,
        isMock: false,
        handleOAuthRedirect,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}