"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface Profile {
  userId: string;
  firstName: string;
  assistantName: string;
  language: string;
}

interface ProfileContextValue {
  profile: Profile | null;
  loading: boolean;
  saveProfile: (data: { firstName: string; assistantName?: string; language?: string }) => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

const STORAGE_KEY = "veronique.user_id";

function getOrCreateUserId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = `usr_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
    window.localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const userId = getOrCreateUserId();
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/profile?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      setProfile(data.profile || null);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveProfile = useCallback(
    async (data: { firstName: string; assistantName?: string; language?: string }) => {
      const userId = getOrCreateUserId();
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...data }),
      });
      const json = await res.json();
      if (json.profile) setProfile(json.profile);
    },
    []
  );

  const reset = useCallback(async () => {
    setProfile(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ProfileContext.Provider value={{ profile, loading, saveProfile, refresh, reset }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
