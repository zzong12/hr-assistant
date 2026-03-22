"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { AppBootstrap } from "@/components/AppBootstrap";
import { useStore } from "@/store/useStore";
import type { ModuleId } from "@/lib/types";

const PATH_TO_MODULE: Array<{ prefix: string; module: ModuleId }> = [
  { prefix: "/scoring-rules", module: "scoring-rules" },
  { prefix: "/candidates", module: "candidates" },
  { prefix: "/interviews", module: "interviews" },
  { prefix: "/history", module: "history" },
  { prefix: "/settings", module: "settings" },
  { prefix: "/jobs", module: "jobs" },
];

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMacElectron, setIsMacElectron] = useState(false);
  const isSidebarCollapsed = useStore((s) => s.isSidebarCollapsed);
  const currentModule = useStore((s) => s.currentModule);
  const isBootstrapped = useStore((s) => s.isBootstrapped);
  const setCurrentModule = useStore((s) => s.setCurrentModule);

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { isElectron?: boolean; platform?: string } }).electronAPI;
    if (api?.isElectron && api.platform === "darwin") {
      setIsMacElectron(true);
    }
  }, []);

  useEffect(() => {
    const matched = PATH_TO_MODULE.find((item) => pathname.startsWith(item.prefix));
    const nextModule = matched?.module || "chat";
    if (nextModule !== currentModule) {
      setCurrentModule(nextModule);
    }
  }, [pathname, currentModule, setCurrentModule]);

  useEffect(() => {
    if (!isBootstrapped) return;
    const controller = new AbortController();
    fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentModule,
        isSidebarCollapsed,
      }),
      signal: controller.signal,
    }).catch(() => {});
    return () => controller.abort();
  }, [currentModule, isSidebarCollapsed, isBootstrapped]);

  return (
    <div className={`flex h-screen overflow-hidden bg-bg-primary ${isMacElectron ? "mac-electron" : ""}`}>
      <AppBootstrap />
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
