"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMacElectron, setIsMacElectron] = useState(false);

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { isElectron?: boolean; platform?: string } }).electronAPI;
    if (api?.isElectron && api.platform === "darwin") {
      setIsMacElectron(true);
    }
  }, []);

  return (
    <div className={`flex h-screen overflow-hidden bg-background ${isMacElectron ? "mac-electron" : ""}`}>
      <Sidebar />
      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
    </div>
  );
}
