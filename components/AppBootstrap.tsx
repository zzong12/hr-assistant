"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import type { Conversation, Message } from "@/lib/types";

type PersistedShape = {
  state?: {
    conversations?: unknown;
    currentModule?: unknown;
    isSidebarCollapsed?: unknown;
  };
};

function parsePersistedState(): {
  conversations: unknown[];
  currentModule?: string;
  isSidebarCollapsed?: boolean;
} | null {
  const raw = localStorage.getItem("hr-assistant-storage");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedShape;
    const state = parsed?.state || {};

    return {
      conversations: Array.isArray(state.conversations) ? state.conversations : [],
      currentModule:
        typeof state.currentModule === "string" ? state.currentModule : undefined,
      isSidebarCollapsed:
        typeof state.isSidebarCollapsed === "boolean"
          ? state.isSidebarCollapsed
          : undefined,
    };
  } catch {
    return null;
  }
}

export function AppBootstrap() {
  const initializedRef = useRef(false);
  const setConversations = useStore((s) => s.setConversations);
  const setUIPreferences = useStore((s) => s.setUIPreferences);
  const setBootstrapped = useStore((s) => s.setBootstrapped);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const boot = async () => {
      const persisted = parsePersistedState();

      if (persisted) {
        try {
          const migrateRes = await fetch("/api/bootstrap/migrate-local-storage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(persisted),
          });

          if (migrateRes.ok) {
            localStorage.removeItem("hr-assistant-storage");
          }
        } catch {
          // keep localStorage when migration fails
        }
      }

      try {
        const [conversationsRes, preferencesRes] = await Promise.all([
          fetch("/api/conversations"),
          fetch("/api/preferences"),
        ]);

        if (conversationsRes.ok) {
          const data = await conversationsRes.json();
          const normalized = (Array.isArray(data.conversations) ? data.conversations : []).map(
            (conversation: Conversation) => ({
              ...conversation,
              createdAt: conversation.createdAt ? new Date(conversation.createdAt) : new Date(),
              updatedAt: conversation.updatedAt ? new Date(conversation.updatedAt) : new Date(),
              messages: Array.isArray(conversation.messages)
                ? conversation.messages.map((message: Message) => ({
                    ...message,
                    timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
                  }))
                : [],
            })
          );
          setConversations(normalized);
        }

        if (preferencesRes.ok) {
          const pref = await preferencesRes.json();
          setUIPreferences({
            currentModule: pref.currentModule,
            isSidebarCollapsed: pref.isSidebarCollapsed,
          });
        }
      } catch {
        // fail silently; app remains usable and can retry on next load
      } finally {
        setBootstrapped(true);
      }
    };

    void boot();
  }, [setConversations, setUIPreferences, setBootstrapped]);

  return null;
}
