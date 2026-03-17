"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare, Briefcase, Users, Calendar, FileText,
  Settings, Plus, ChevronLeft, ChevronRight, Sparkles, Bot,
} from "lucide-react";
import { useStore } from "@/store/useStore";

const modules = [
  { id: "chat", name: "对话助手", icon: MessageSquare, href: "/" },
  { id: "jobs", name: "职位管理", icon: Briefcase, href: "/jobs" },
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

  return (
    <div
      className={`border-r border-border bg-sidebar flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
        isSidebarCollapsed ? "w-[68px]" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center glow-primary">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold gradient-text">小HR</h1>
                <p className="text-[10px] text-muted-foreground leading-tight">AI数字员工</p>
              </div>
            </div>
          )}
          {isSidebarCollapsed && (
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center mx-auto glow-primary">
              <Bot className="w-5 h-5 text-white" />
            </div>
          )}
          {!isSidebarCollapsed && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-60 hover:opacity-100 transition-opacity" onClick={toggleSidebar}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {isSidebarCollapsed && (
          <Button variant="ghost" size="icon" className="h-7 w-7 mx-auto mt-2 opacity-60 hover:opacity-100 transition-opacity" onClick={toggleSidebar}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* New Chat */}
      <div className="p-3">
        <Button
          className={`w-full gradient-primary text-white shadow-md hover:shadow-lg transition-all duration-200 ${isSidebarCollapsed ? "px-0" : ""}`}
          size="sm"
          onClick={handleNewChat}
        >
          <Plus className="w-4 h-4" />
          {!isSidebarCollapsed && <span className="ml-2">新对话</span>}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div className="px-2 space-y-0.5">
          {modules.map((module) => {
            const Icon = module.icon;
            const active = isActive(module.href);
            return (
              <Link key={module.id} href={module.href}>
                <div
                  className={`relative flex items-center rounded-lg px-3 py-2 text-sm transition-all duration-200 group ${
                    isSidebarCollapsed ? "justify-center px-2" : ""
                  } ${
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full gradient-primary" />
                  )}
                  <Icon className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? "text-primary" : ""}`} />
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
          <>
            <Separator className="my-3 mx-3" />
            <div className="px-3 pb-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                最近对话
              </p>
              <div className="space-y-0.5">
                {conversations.slice(0, 8).map((conv) => (
                  <button
                    key={conv.id}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg truncate transition-all duration-200 ${
                      currentConversation?.id === conv.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }`}
                    onClick={() => setCurrentConversation(conv)}
                  >
                    {conv.title || "新对话"}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </ScrollArea>

      {/* User */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white text-xs font-bold shadow-sm">
              HR
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-sidebar" />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">HR Manager</p>
              <p className="text-[10px] text-green-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-soft" />在线
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
