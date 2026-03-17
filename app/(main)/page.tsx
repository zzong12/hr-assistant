"use client";

import { ChatInterface } from "@/components/ChatInterface";
import { InfoPanel } from "@/components/InfoPanel";

export default function ChatPage() {
  return (
    <div className="flex h-full min-h-0">
      <ChatInterface />
      <InfoPanel />
    </div>
  );
}
