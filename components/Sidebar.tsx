"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare, Briefcase, Users, Calendar, FileText,
  Settings, Plus, ChevronLeft, ChevronRight, Sparkles, LogOut, Target,
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

  return (
    <div
      className={`app-sidebar border-r border-border bg-sidebar/80 backdrop-blur-xl flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
        isSidebarCollapsed ? "w-[72px]" : "w-64"
      }`}
    >
      {/* Logo — also serves as drag region on macOS Electron (traffic lights sit here) */}
      <div className="p-5 flex flex-col items-center border-b border-border/50 page-drag-header mac-electron-top-spacing">
        <div className="flex items-center justify-between w-full">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 gradient-primary rounded-xl blur-[8px] opacity-60 animate-glow-pulse" />
                <div className="relative w-10 h-10 rounded-xl gradient-primary flex items-center justify-center border border-white/20 shadow-xl animate-float">
                  <NexusLogo className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight gradient-text">Nexus</h1>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">HR Copilot</p>
              </div>
            </div>
          )}
          {isSidebarCollapsed && (
            <div className="relative mx-auto">
              <div className="absolute inset-0 gradient-primary rounded-xl blur-[8px] opacity-60 animate-glow-pulse" />
              <div className="relative w-10 h-10 rounded-xl gradient-primary flex items-center justify-center border border-white/20 shadow-xl animate-float">
                <NexusLogo className="w-5 h-5 text-white" />
              </div>
            </div>
          )}
          {!isSidebarCollapsed && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-40 hover:opacity-100 hover:bg-muted/50 rounded-full transition-all electron-no-drag" onClick={toggleSidebar}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
        {isSidebarCollapsed && (
          <Button variant="ghost" size="icon" className="h-7 w-7 mx-auto mt-3 opacity-40 hover:opacity-100 hover:bg-muted/50 rounded-full transition-all electron-no-drag" onClick={toggleSidebar}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* New Chat */}
      <div className="p-4">
        <Button
          className={`w-full gradient-primary text-white shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 rounded-full ${isSidebarCollapsed ? "px-0 aspect-square rounded-full h-10 w-10 mx-auto block" : "h-10"}`}
          onClick={handleNewChat}
        >
          <Plus className={`w-4 h-4 ${isSidebarCollapsed ? "mx-auto" : "mr-2"}`} />
          {!isSidebarCollapsed && <span className="font-medium">新对话</span>}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1">
          {modules.map((module) => {
            const Icon = module.icon;
            const active = isActive(module.href);
            return (
              <Link key={module.id} href={module.href}>
                <div
                  className={`relative flex items-center rounded-full px-3 py-2.5 text-sm font-medium transition-all duration-300 group ${
                    isSidebarCollapsed ? "justify-center px-0 w-10 h-10 mx-auto" : ""
                  } ${
                    active
                      ? "bg-primary/10 text-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  {active && !isSidebarCollapsed && (
                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
                  )}
                  <Icon className={`w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110 ${active ? "text-primary" : ""} ${!isSidebarCollapsed && active ? "ml-3" : ""}`} />
                  {!isSidebarCollapsed && (
                    <span className="ml-3">{module.name}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Recent Conversations */}
        {!isSidebarCollapsed && pathname === "/" && conversations.length > 0 && (
          <div className="mt-6">
            <h3 className="px-3 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-2 flex items-center gap-2">
              <span>最近对话</span>
              <div className="h-[1px] flex-1 bg-border/50" />
            </h3>
            <div className="space-y-0.5">
              {conversations.slice(0, 8).map((conv) => (
                <button
                  key={conv.id}
                  className={`w-full text-left text-xs px-3 py-2 rounded-xl truncate transition-all duration-200 border ${
                    currentConversation?.id === conv.id
                      ? "bg-card border-border/50 shadow-sm text-foreground font-medium"
                      : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                  onClick={() => setCurrentConversation(conv)}
                >
                  {conv.title || "新对话"}
                </button>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* User */}
      <div className="p-4 border-t border-border/50 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold shadow-md">
              N
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-background shadow-sm" />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-foreground/90">Admin</p>
              <p className="text-[10px] text-green-500 font-medium flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-soft" />在线
              </p>
            </div>
          )}
          {!isSidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 opacity-40 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive rounded-full transition-all"
              onClick={handleLogout}
              title="退出登录"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
