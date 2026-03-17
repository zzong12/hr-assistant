"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  FileText,
  Trash2,
  MessageSquare,
  MoreHorizontal,
  Download,
  Star,
  StarOff,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store/useStore";
import type { Conversation } from "@/lib/types";

export default function HistoryPage() {
  const router = useRouter();
  const conversations = useStore((s) => s.conversations);
  const setCurrentConversation = useStore((s) => s.setCurrentConversation);
  const deleteConversation = useStore((s) => s.deleteConversation);
  const updateConversation = useStore((s) => s.updateConversation);
  const [searchQuery, setSearchQuery] = useState("");
  const [serverConversations, setServerConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      setServerConversations(data.conversations || []);
    } catch {
      // fall back to store data
    } finally {
      setLoading(false);
    }
  };

  // Merge store and server conversations
  const allConversations = [
    ...conversations,
    ...serverConversations.filter(
      (sc) => !conversations.find((c) => c.id === sc.id)
    ),
  ].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const filteredConversations = allConversations.filter((conv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      conv.title.toLowerCase().includes(q) ||
      conv.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  });

  const handleOpen = (conv: Conversation) => {
    setCurrentConversation(conv);
    router.push("/");
  };

  const handleDelete = (id: string) => {
    deleteConversation(id);
    fetch(`/api/conversations?id=${id}`, { method: "DELETE" }).catch(() => {});
    toast.success("对话已删除");
  };

  const handleToggleFavorite = (conv: Conversation) => {
    updateConversation(conv.id, { favorite: !conv.favorite });
    toast.success(conv.favorite ? "已取消收藏" : "已收藏");
  };

  const handleExport = (conv: Conversation, format: "md" | "json") => {
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === "md") {
      content = `# ${conv.title}\n\n`;
      content += conv.messages
        .map(
          (m) =>
            `**${m.role === "user" ? "我" : "助手"}** (${new Date(m.timestamp).toLocaleString()}):\n\n${m.content}\n\n---\n`
        )
        .join("\n");
      filename = `${conv.title}.md`;
      mimeType = "text/markdown";
    } else {
      content = JSON.stringify(conv, null, 2);
      filename = `${conv.title}.json`;
      mimeType = "application/json";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("导出成功");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold mb-3">历史记录</h1>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索对话..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-3 max-w-3xl mx-auto">
          {/* Favorites first */}
          {filteredConversations
            .filter((c) => c.favorite)
            .map((conv) => (
              <ConversationCard
                key={conv.id}
                conv={conv}
                onOpen={handleOpen}
                onDelete={handleDelete}
                onToggleFavorite={handleToggleFavorite}
                onExport={handleExport}
              />
            ))}

          {filteredConversations
            .filter((c) => !c.favorite)
            .map((conv) => (
              <ConversationCard
                key={conv.id}
                conv={conv}
                onOpen={handleOpen}
                onDelete={handleDelete}
                onToggleFavorite={handleToggleFavorite}
                onExport={handleExport}
              />
            ))}

          {filteredConversations.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{searchQuery ? "没有匹配的对话" : "暂无对话记录"}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ConversationCard({
  conv,
  onOpen,
  onDelete,
  onToggleFavorite,
  onExport,
}: {
  conv: Conversation;
  onOpen: (c: Conversation) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (c: Conversation) => void;
  onExport: (c: Conversation, format: "md" | "json") => void;
}) {
  const messageCount = conv.messages.filter((m) => m.id !== "welcome").length;

  return (
    <Card
      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onOpen(conv)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
            <h3 className="font-medium text-sm truncate">{conv.title || "新对话"}</h3>
            {conv.favorite && (
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{new Date(conv.updatedAt).toLocaleDateString()}</span>
            <span>{messageCount} 条消息</span>
          </div>
          {conv.messages.length > 1 && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {conv.messages.find((m) => m.role === "user")?.content || ""}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(conv);
              }}
            >
              {conv.favorite ? (
                <StarOff className="w-4 h-4 mr-2" />
              ) : (
                <Star className="w-4 h-4 mr-2" />
              )}
              {conv.favorite ? "取消收藏" : "收藏"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onExport(conv, "md");
              }}
            >
              <Download className="w-4 h-4 mr-2" /> 导出 Markdown
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onExport(conv, "json");
              }}
            >
              <Download className="w-4 h-4 mr-2" /> 导出 JSON
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" /> 删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
