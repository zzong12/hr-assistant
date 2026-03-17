"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Send, Loader2, AlertCircle, Sparkles, Upload,
  Briefcase, User, Calendar, CheckCircle2, FileText,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import { NexusLogo } from "@/components/NexusLogo";
import type { Message, Conversation, ChatAction } from "@/lib/types";

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: "__WELCOME__",
  timestamp: new Date(),
};

interface ActionResult {
  action: ChatAction;
  success: boolean;
  message: string;
}

function parseActions(content: string): { cleanContent: string; actions: ChatAction[] } {
  const actions: ChatAction[] = [];
  const cleanContent = content.replace(
    /<!--ACTION:([\s\S]*?)-->/g,
    (_, json) => {
      try {
        actions.push(JSON.parse(json.trim()));
      } catch { /* skip malformed */ }
      return "";
    }
  ).trim();
  return { cleanContent, actions };
}

async function executeAction(action: ChatAction): Promise<ActionResult> {
  try {
    switch (action.type) {
      case "create_job": {
        const res = await fetch("/api/jobs/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            freeText: `职位名称: ${action.data.title}, 部门: ${action.data.department}, 级别: ${action.data.level}, 技能: ${(action.data.skills || []).join(",")}`,
            save: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return { action, success: true, message: `已创建职位「${data.job?.title || action.data.title}」` };
      }
      case "create_candidate": {
        const res = await fetch("/api/candidates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: action.data.name || "",
            email: action.data.email || "",
            phone: action.data.phone || "",
            resumeText: action.data.resumeText || "",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return { action, success: true, message: `已创建候选人「${data.name || action.data.name}」` };
      }
      case "update_status": {
        const res = await fetch("/api/candidates", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: action.data.candidateId,
            status: action.data.newStatus,
          }),
        });
        if (!res.ok) throw new Error("更新失败");
        const statusMap: Record<string, string> = {
          offered: "已发Offer", hired: "已录用", rejected: "已淘汰",
          interview: "面试中", screening: "筛选中",
        };
        return { action, success: true, message: `候选人状态已更新为「${statusMap[action.data.newStatus] || action.data.newStatus}」` };
      }
      case "schedule_interview": {
        const res = await fetch("/api/interviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: action.data.jobId,
            candidateId: action.data.candidateId,
            scheduledTime: action.data.scheduledTime,
            location: action.data.location || "待定",
            interviewer: action.data.interviewer || "待定",
            autoGenerate: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return { action, success: true, message: `已安排面试：${data.candidateName || "候选人"} → ${data.jobTitle || "职位"}` };
      }
      case "match_candidate": {
        const res = await fetch(`/api/candidates/${action.data.candidateId}/match`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: action.data.jobId }),
        });
        if (!res.ok) throw new Error("匹配失败");
        return { action, success: true, message: "职位匹配完成" };
      }
      default:
        return { action, success: false, message: `未知操作: ${action.type}` };
    }
  } catch (err) {
    return { action, success: false, message: err instanceof Error ? err.message : "操作失败" };
  }
}

function ActionCard({ result }: { result: ActionResult }) {
  const iconMap: Record<string, React.ReactNode> = {
    create_job: <Briefcase className="w-4 h-4" />,
    create_candidate: <User className="w-4 h-4" />,
    schedule_interview: <Calendar className="w-4 h-4" />,
    update_status: <CheckCircle2 className="w-4 h-4" />,
    match_candidate: <Sparkles className="w-4 h-4" />,
  };
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm animate-fade-in transition-all duration-300 shadow-sm border ${
        result.success
          ? "bg-green-50/50 text-green-700 border-green-100 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/50"
          : "bg-red-50/50 text-red-700 border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 ${
          result.success ? "bg-green-100 dark:bg-green-900/50" : "bg-red-100 dark:bg-red-900/50"
        }`}
      >
        {result.success ? iconMap[result.action.type] || <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      </div>
      <span className="font-medium">{result.message}</span>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center animate-fade-in pb-20">
      <div className="text-center max-w-2xl w-full px-6">
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 gradient-primary rounded-3xl blur-[12px] opacity-40 animate-glow-pulse" />
          <div className="relative w-full h-full rounded-3xl gradient-primary flex items-center justify-center border-2 border-white/20 shadow-2xl animate-float">
            <NexusLogo className="w-12 h-12 text-white" />
          </div>
        </div>
        <h2 className="text-4xl font-black tracking-tight gradient-text mb-4">Welcome to Nexus</h2>
        <p className="text-muted-foreground text-lg mb-12 font-medium">
          您的 AI 招聘搭档，对话即可驱动全流程
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          {[
            { icon: Briefcase, title: "发布职位", desc: '"招一个Go后端"' },
            { icon: FileText, title: "分析简历", desc: "拖入PDF文件" },
            { icon: Calendar, title: "安排面试", desc: '"给张三安排面试"' },
            { icon: Sparkles, title: "评估反馈", desc: '"张三表现如何"' },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="glass-panel rounded-2xl p-5 hover:shadow-lg transition-all duration-300 cursor-default group hover:-translate-y-1"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm font-bold text-foreground mb-1">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChatInterface() {
  const currentConversation = useStore((s) => s.currentConversation);
  const setCurrentConversation = useStore((s) => s.setCurrentConversation);
  const addConversation = useStore((s) => s.addConversation);
  const updateConversation = useStore((s) => s.updateConversation);

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [actionResults, setActionResults] = useState<Record<string, ActionResult[]>>({});
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentConversation) {
      setMessages(currentConversation.messages.length > 0 ? currentConversation.messages : [WELCOME_MESSAGE]);
      conversationIdRef.current = currentConversation.id;
    } else {
      setMessages([WELCOME_MESSAGE]);
      conversationIdRef.current = null;
    }
  }, [currentConversation]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      const viewport = el.parentElement;
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, streamingContent]);

  const saveConversation = useCallback(
    (msgs: Message[]) => {
      const realMessages = msgs.filter((m) => m.id !== "welcome");
      if (realMessages.length === 0) return;
      const firstUserMsg = realMessages.find((m) => m.role === "user")?.content || "";
      const title = firstUserMsg.length > 20 ? firstUserMsg.slice(0, 20) + "…" : (firstUserMsg || "新对话");
      if (conversationIdRef.current) {
        updateConversation(conversationIdRef.current, { messages: msgs, title });
      } else {
        const newConv: Conversation = {
          id: `conv-${Date.now()}`,
          title,
          messages: msgs,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        conversationIdRef.current = newConv.id;
        addConversation(newConv);
        setCurrentConversation(newConv);
      }
    },
    [updateConversation, addConversation, setCurrentConversation]
  );

  const handleSend = async (overrideMessage?: string) => {
    const trimmed = (overrideMessage || input).trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (!overrideMessage) setInput("");
    setIsLoading(true);
    setError(null);
    setStreamingContent("");
    setCurrentAgent(null);

    try {
      const history = messages.filter((m) => m.id !== "welcome").slice(-10).map((msg) => ({ role: msg.role, content: msg.content }));
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversationHistory: history, stream: true }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `请求失败 (${response.status})`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      let fullContent = "";
      let agentUsed = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                setStreamingContent(fullContent);
              }
              if (parsed.agentUsed) {
                agentUsed = parsed.agentUsed;
                setCurrentAgent(agentUsed);
              }
              if (parsed.error) setError(parsed.error);
            } catch { /* skip */ }
          }
        }
      }

      const { cleanContent, actions } = parseActions(fullContent);

      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: cleanContent,
        timestamp: new Date(),
        metadata: agentUsed ? { agentUsed } : undefined,
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      setStreamingContent("");
      saveConversation(finalMessages);

      if (actions.length > 0) {
        const results: ActionResult[] = [];
        for (const action of actions) {
          const result = await executeAction(action);
          results.push(result);
          if (result.success) toast.success(result.message);
          else toast.error(result.message);
        }
        setActionResults((prev) => ({ ...prev, [assistantMessage.id]: results }));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "发送失败";
      setError(errorMsg);
      toast.error("发送失败: " + errorMsg);
      const errorMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: "抱歉，处理消息时出现错误。请稍后重试。",
        timestamp: new Date(),
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
      setCurrentAgent(null);
    }
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      toast.info(`正在分析简历: ${file.name}`);

      try {
        const res = await fetch("/api/candidates/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast.success(`简历已分析: ${data.name}`);

        const systemMsg: Message = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content:
            `已收到并分析简历文件 **${file.name}**\n\n` +
            `**候选人**: ${data.name}\n` +
            `**技能**: ${data.resume?.parsedData?.skills?.join(", ") || "解析中..."}\n` +
            `**状态**: 已自动创建候选人档案`,
          timestamp: new Date(),
          metadata: { agentUsed: "简历筛选专员" },
        };
        setMessages((prev) => {
          const next = [...prev, systemMsg];
          saveConversation(next);
          return next;
        });
      } catch (err) {
        toast.error(`简历分析失败: ${err instanceof Error ? err.message : "未知错误"}`);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = e.clipboardData.files;
    if (files.length > 0) {
      e.preventDefault();
      handleFileUpload(files);
      return;
    }
    const text = e.clipboardData.getData("text");
    if (text.length > 500) {
      e.preventDefault();
      const isResume = /工作经[历验]|教育背景|技能|项目经[历验]|自我评价|求职意向|联系方式|experience|education|skills/i.test(text);
      if (isResume) {
        handleSend(`请帮我分析这份简历：\n\n${text}`);
      } else {
        setInput(text);
        toast.info("已粘贴长文本，按 Ctrl+Enter 发送");
      }
    }
  };

  const showWelcome = messages.length === 1 && messages[0].id === "welcome";

  return (
    <div
      className="flex-1 flex flex-col min-h-0 bg-background relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary/5 border-2 border-dashed border-primary rounded-2xl flex items-center justify-center backdrop-blur-sm animate-fade-in animate-dash-border">
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-icon-zoom">
              <Upload className="w-10 h-10 text-primary" />
            </div>
            <p className="text-xl font-semibold text-primary">拖放简历文件到这里</p>
            <p className="text-sm text-muted-foreground mt-1">支持 PDF、TXT 格式</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 h-14 border-b border-border/40 px-6 flex items-center justify-between glass">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8">
            <div className="absolute inset-0 gradient-primary rounded-xl blur-[4px] opacity-40 animate-pulse" />
            <div className="relative w-8 h-8 rounded-xl gradient-primary flex items-center justify-center border border-white/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>
          <h2 className="text-sm font-bold tracking-wide">{currentConversation?.title || "Nexus HR"}</h2>
        </div>
        {currentAgent && (
          <Badge variant="outline" className="text-[10px] animate-pulse-soft gap-2 border-primary/20 bg-primary/5 py-1 px-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {currentAgent}
          </Badge>
        )}
      </div>

      {/* Messages */}
      {showWelcome ? (
        <WelcomeScreen />
      ) : (
        <ScrollArea className="flex-1 pt-14 pb-28">
          <div ref={scrollRef} className="w-full max-w-[92%] mx-auto p-6 space-y-8">
            {messages
              .filter((m) => m.id !== "welcome")
              .map((message) => (
                <div key={message.id} className="animate-fade-in group">
                  <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} gap-3`}>
                    {message.role === "assistant" && (
                      <div className="relative shrink-0 mt-1">
                        <div className="absolute inset-0 gradient-primary rounded-full blur-[4px] opacity-40" />
                        <div className="relative w-8 h-8 rounded-full gradient-primary flex items-center justify-center border border-white/20 shadow-sm">
                          <NexusLogo className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                        message.role === "user"
                          ? "gradient-primary text-white shadow-lg shadow-primary/20 rounded-tr-sm"
                          : "bg-card shadow-sm border border-border/40 rounded-tl-sm hover:shadow-md transition-shadow"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {message.content.length > 500 ? message.content.slice(0, 500) + "..." : message.content}
                        </p>
                      )}
                      <div className={`flex items-center gap-2 mt-2 opacity-50 ${message.role === "user" ? "justify-end text-white" : "justify-start text-muted-foreground"}`}>
                        <span className="text-[10px] font-medium tracking-wider">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {message.metadata?.agentUsed && (
                          <span className="text-[10px] font-medium tracking-wider px-1.5 py-0.5 rounded border border-current/30">
                            {message.metadata.agentUsed}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {actionResults[message.id] && (
                    <div className="ml-11 mt-3 space-y-2 max-w-[85%]">
                      {actionResults[message.id].map((result, i) => (
                        <ActionCard key={i} result={result} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            {streamingContent && (
              <div className="flex justify-start gap-3 animate-fade-in">
                <div className="relative shrink-0 mt-1">
                  <div className="absolute inset-0 gradient-primary rounded-full blur-[4px] opacity-60 animate-glow-pulse" />
                  <div className="relative w-8 h-8 rounded-full gradient-primary flex items-center justify-center border border-white/20 shadow-sm animate-pulse-soft">
                    <NexusLogo className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-5 py-4 bg-card shadow-sm border border-primary/20">
                  <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed">
                    <ReactMarkdown>{streamingContent.replace(/<!--ACTION:[\s\S]*?-->/g, "")}</ReactMarkdown>
                  </div>
                  <div className="flex items-center gap-2 mt-3 opacity-60">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse [animation-delay:300ms]" />
                    </div>
                    {currentAgent && <span className="text-[10px] font-medium tracking-wider">{currentAgent}</span>}
                  </div>
                </div>
              </div>
            )}
            {isLoading && !streamingContent && (
              <div className="flex justify-start gap-3 animate-fade-in">
                <div className="relative shrink-0 mt-1">
                  <div className="absolute inset-0 gradient-primary rounded-full blur-[4px] opacity-60 animate-glow-pulse" />
                  <div className="relative w-8 h-8 rounded-full gradient-primary flex items-center justify-center border border-white/20 shadow-sm animate-pulse-soft">
                    <NexusLogo className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="rounded-2xl rounded-tl-sm px-5 py-4 bg-card shadow-sm border border-border/40">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" />
                      <span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse [animation-delay:300ms]" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground tracking-wide">AI 思考中...</span>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="flex justify-start gap-3 animate-fade-in">
                <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-1">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                </div>
                <div className="rounded-2xl rounded-tl-sm px-5 py-3 bg-destructive/5 border border-destructive/20 max-w-[85%]">
                  <span className="text-sm text-destructive leading-relaxed">{error}</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Floating Command Bar */}
      <div className="absolute bottom-6 left-0 right-0 px-6 pointer-events-none z-20">
        <div className="w-full max-w-[92%] lg:max-w-3xl mx-auto pointer-events-auto">
          <div className="glass-panel p-2 rounded-2xl shadow-2xl flex items-end gap-2.5 transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/30 focus-within:shadow-primary/10">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              className="hidden"
              multiple
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 shrink-0 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors mb-0.5"
              onClick={() => fileInputRef.current?.click()}
              title="上传简历或文档"
            >
              <FileText className="w-5 h-5" />
            </Button>
            <Textarea
              placeholder="输入指令，或粘贴内容..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              className="flex-1 min-h-[52px] max-h-[160px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 py-3.5 px-2 text-base font-medium placeholder:text-muted-foreground/60"
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-12 w-12 shrink-0 rounded-xl gradient-primary text-white shadow-md hover:shadow-lg transition-all disabled:opacity-30 mb-0.5"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
            </Button>
          </div>
          <div className="text-center mt-3 animate-fade-in">
            <p className="text-[10px] font-medium text-muted-foreground/60 tracking-wider">
              支持拖拽文档 · Ctrl+Enter 发送 · 智能识别意图
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
