"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Briefcase,
  Users,
  Calendar,
  FileText,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Target,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { NexusLogo } from "@/components/NexusLogo";

const modules = [
  { id: "chat", name: "对话助手", icon: MessageSquare, href: "/" },
  { id: "jobs", name: "职位管理", icon: Briefcase, href: "/jobs" },
  { id: "scoring-rules", name: "评分参考", icon: Target, href: "/scoring-rules" },
  { id: "candidates", name: "候选人", icon: Users, href: "/candidates" },
  { id: "interviews", name: "面试管理", icon: Calendar, href: "/interviews" },
  { id: "history", name: "历史记录", icon: FileText, href: "/history" },
  { id: "settings", name: "设置", icon: Settings, href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const isSidebarCollapsed = useStore((s) => s.isSidebarCollapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const conversations = useStore((s) => s.conversations);
  const currentConversation = useStore((s) => s.currentConversation);
  const setCurrentConversation = useStore((s) => s.setCurrentConversation);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const handleNewChat = () => {
    setCurrentConversation(null);
    if (pathname !== "/") router.push("/");
  };

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  };

  const nav = (
    <ScrollArea className="flex-1 px-2 py-3">
      <nav className="space-y-1">
        {modules.map((module) => {
          const Icon = module.icon;
          const active = isActive(module.href);

          return (
            <Link
              key={module.id}
              href={module.href}
              className={[
                "h-9 rounded-[var(--radius-md)] flex items-center transition-colors",
                isSidebarCollapsed ? "justify-center" : "px-3 gap-2.5",
                active
                  ? "bg-accent-blue-muted text-accent-blue"
                  : "text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary",
              ].join(" ")}
            >
              <Icon className="size-4 shrink-0" />
              {!isSidebarCollapsed && (
                <span className="text-sm whitespace-nowrap">{module.name}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {!isSidebarCollapsed && pathname === "/" && conversations.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary px-2 mb-2">
            最近对话
          </h3>
          <div className="space-y-1">
            {conversations.slice(0, 8).map((conv) => (
              <button
                key={conv.id}
                className={[
                  "w-full text-left text-xs px-2.5 py-2 rounded-[var(--radius-md)] border transition-colors",
                  currentConversation?.id === conv.id
                    ? "border-border-secondary bg-bg-tertiary text-text-primary"
                    : "border-transparent text-text-tertiary hover:bg-bg-tertiary hover:text-text-secondary",
                ].join(" ")}
                onClick={() => setCurrentConversation(conv)}
              >
                <span className="truncate block">{conv.title || "新对话"}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </ScrollArea>
  );

  return (
    <Tooltip.Provider delayDuration={0}>
      <aside
        className={[
          "app-sidebar border-r border-border-primary bg-bg-secondary flex flex-col min-h-0 transition-all duration-300",
          isSidebarCollapsed ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-expanded)]",
        ].join(" ")}
      >
        <div className="h-[var(--topbar-height)] border-b border-border-primary flex items-center px-3 page-drag-header mac-electron-top-spacing">
          <Link href="/" className="flex items-center gap-2 overflow-hidden flex-1 electron-no-drag">
            <div className="size-8 rounded-[var(--radius-md)] bg-accent-blue/90 text-white flex items-center justify-center shrink-0">
              <NexusLogo className="w-4 h-4" />
            </div>
            {!isSidebarCollapsed && (
              <div className="leading-tight">
                <p className="text-sm font-semibold text-text-primary whitespace-nowrap">Nexus HR</p>
                <p className="text-[10px] text-text-tertiary uppercase tracking-wide">Commercial Console</p>
              </div>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            className="shrink-0 electron-no-drag"
          >
            {isSidebarCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>

        <div className="px-2 pt-3">
          <Button
            variant="default"
            className={[
              "w-full",
              isSidebarCollapsed ? "size-9 p-0 justify-center" : "justify-start",
            ].join(" ")}
            onClick={handleNewChat}
          >
            <Plus className="size-4" />
            {!isSidebarCollapsed && <span>新对话</span>}
          </Button>
        </div>

        {nav}

        <div className="border-t border-border-primary p-3 bg-bg-primary/40">
          <div className={[
            "flex items-center",
            isSidebarCollapsed ? "justify-center" : "justify-between",
          ].join(" ")}>
            {!isSidebarCollapsed && (
              <div>
                <p className="text-sm font-medium text-text-primary">Admin</p>
                <p className="text-[10px] text-text-tertiary">在线</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleLogout}
              title="退出登录"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>
    </Tooltip.Provider>
  );
}
