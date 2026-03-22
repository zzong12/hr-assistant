"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send, Loader2, AlertCircle, Sparkles, Upload,
  Briefcase, User, Calendar, CheckCircle2, FileText, Mic, MicOff,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import { NexusLogo } from "@/components/NexusLogo";
import type { Message, Conversation, ChatAction } from "@/lib/types";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: "__WELCOME__",
  timestamp: new Date(),
};

type SlashCommandKey = "ai" | "jd" | "resume" | "interview" | "comm" | "score" | "help";
type ForcedAgentId =
  | "concierge"
  | "jd_generator"
  | "resume_screener"
  | "interview_coordinator"
  | "communication_specialist"
  | "scoring_rule_generator";

interface SlashCommandDef {
  key: SlashCommandKey;
  forcedAgent?: ForcedAgentId;
  title: string;
  description: string;
  placeholder: string;
}

const SLASH_COMMANDS: SlashCommandDef[] = [
  { key: "ai", forcedAgent: "concierge", title: "通用助手", description: "主控 Agent，处理综合任务", placeholder: "<ask anything>" },
  { key: "jd", forcedAgent: "jd_generator", title: "JD 专员", description: "生成/优化职位描述", placeholder: "<job request>" },
  { key: "resume", forcedAgent: "resume_screener", title: "简历专员", description: "筛选候选人、简历分析", placeholder: "<resume task>" },
  { key: "interview", forcedAgent: "interview_coordinator", title: "面试专员", description: "面试安排与题目生成", placeholder: "<interview task>" },
  { key: "comm", forcedAgent: "communication_specialist", title: "沟通专员", description: "候选人沟通话术", placeholder: "<communication task>" },
  { key: "score", forcedAgent: "scoring_rule_generator", title: "评分专员", description: "生成岗位评分规则", placeholder: "<scoring task>" },
  { key: "help", title: "帮助", description: "查看全部可用指令", placeholder: "" },
];

const SLASH_COMMAND_MAP = new Map(SLASH_COMMANDS.map((item) => [item.key, item]));

function parseSlashInput(input: string): { command: string; payload: string } | null {
  const match = input.match(/^\/([a-zA-Z]+)(?:\s+([\s\S]*))?$/);
  if (!match) return null;
  return {
    command: match[1].toLowerCase(),
    payload: (match[2] || "").trim(),
  };
}

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
  const [isCurrentAgentForced, setIsCurrentAgentForced] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [commandMenuIndex, setCommandMenuIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isSupported, isListening, startListening, stopListening } = useSpeechRecognition({
    lang: "zh-CN",
    continuous: true,
    interimResults: true,
    onFinalText: (finalText) => {
      setInput((prev) => {
        const base = prev.trim();
        return base ? `${base} ${finalText.trim()}` : finalText.trim();
      });
    },
    onInterimText: (text) => {
      setInterimText(text);
    },
    onError: (code) => {
      if (code === "not-allowed") {
        toast.error("麦克风权限被拒绝，请在浏览器设置中允许访问");
      }
    },
    onEnd: () => {
      setInterimText("");
    },
  });

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

  useEffect(() => {
    setIsVoiceSupported(isSupported);
  }, [isSupported]);

  const slashMatch = useMemo(() => {
    if (!input.startsWith("/")) return null;
    return input.match(/^\/([a-zA-Z]*)(?:\s+([\s\S]*))?$/);
  }, [input]);

  const slashKeyword = (slashMatch?.[1] || "").toLowerCase();
  const slashHasPayload = Boolean((slashMatch?.[2] || "").trim());
  const isCommandMenuOpen = Boolean(slashMatch) && !slashHasPayload;

  const commandSuggestions = useMemo(() => {
    if (!isCommandMenuOpen) return [];
    return SLASH_COMMANDS.filter((cmd) => cmd.key.startsWith(slashKeyword));
  }, [isCommandMenuOpen, slashKeyword]);

  useEffect(() => {
    setCommandMenuIndex(0);
  }, [slashKeyword, isCommandMenuOpen]);

  useEffect(() => {
    if (!isCommandMenuOpen) return;
    if (commandMenuIndex >= commandSuggestions.length) {
      setCommandMenuIndex(Math.max(0, commandSuggestions.length - 1));
    }
  }, [commandMenuIndex, commandSuggestions.length, isCommandMenuOpen]);

  const applyCommandCompletion = useCallback((cmd: SlashCommandDef) => {
    setInput(`/${cmd.key}${cmd.key === "help" ? "" : " "}`);
  }, []);

  const saveConversation = useCallback(
    async (msgs: Message[]) => {
      const realMessages = msgs.filter((m) => m.id !== "welcome");
      if (realMessages.length === 0) return;
      const firstUserMsg = realMessages.find((m) => m.role === "user")?.content || "";
      const title = firstUserMsg.length > 20 ? firstUserMsg.slice(0, 20) + "…" : (firstUserMsg || "新对话");
      const now = new Date();

      let nextConversation: Conversation;
      if (conversationIdRef.current) {
        nextConversation = {
          id: conversationIdRef.current,
          title,
          messages: msgs,
          createdAt: currentConversation?.createdAt || now,
          updatedAt: now,
          favorite: currentConversation?.favorite,
          archived: currentConversation?.archived,
          context: currentConversation?.context,
        };
        updateConversation(conversationIdRef.current, { messages: msgs, title });
      } else {
        nextConversation = {
          id: `conv-${Date.now()}`,
          title,
          messages: msgs,
          createdAt: now,
          updatedAt: now,
        };
        conversationIdRef.current = nextConversation.id;
        addConversation(nextConversation);
        setCurrentConversation(nextConversation);
      }

      try {
        await fetch("/api/conversations", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextConversation),
        });
      } catch {
        // Keep app usable even if persistence fails transiently.
      }
    },
    [updateConversation, addConversation, setCurrentConversation, currentConversation]
  );

  const handleSend = async (overrideMessage?: string) => {
    if (isListening) stopListening();
    const rawInput = (overrideMessage || input).trim();
    if (!rawInput || isLoading) return;

    const parsedSlash = parseSlashInput(rawInput);
    const isSlashCommand = Boolean(parsedSlash);
    let outboundMessage = rawInput;
    let forcedAgent: ForcedAgentId | undefined;

    if (isSlashCommand && parsedSlash) {
      const commandDef = SLASH_COMMAND_MAP.get(parsedSlash.command as SlashCommandKey);
      if (!commandDef) {
        const available = SLASH_COMMANDS.map((cmd) => `/${cmd.key}`).join(" ");
        toast.error(`未知指令: /${parsedSlash.command}。可用: ${available}`);
        return;
      }
      if (commandDef.key === "help") {
        const userMessage: Message = {
          id: `msg-${Date.now()}`,
          role: "user",
          content: rawInput,
          timestamp: new Date(),
        };
        const helpMessage: Message = {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          content: [
            "### Slash Commands",
            "",
            ...SLASH_COMMANDS.map((cmd) =>
              `- \`/${cmd.key}\` ${cmd.description}${cmd.key === "help" ? "" : ` · 例：\`/${cmd.key} ${cmd.placeholder}\``}`
            ),
          ].join("\n"),
          timestamp: new Date(),
          metadata: { agentUsed: "Slash Help", forcedAgentUsed: true },
        };
        const nextMessages = [...messages, userMessage, helpMessage];
        setMessages(nextMessages);
        if (!overrideMessage) setInput("");
        await saveConversation(nextMessages);
        return;
      }
      if (!parsedSlash.payload) {
        toast.info(`请补充参数：/${commandDef.key} ${commandDef.placeholder}`);
        return;
      }
      outboundMessage = parsedSlash.payload;
      forcedAgent = commandDef.forcedAgent;
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: rawInput,
      timestamp: new Date(),
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (!overrideMessage) setInput("");
    setIsLoading(true);
    setError(null);
    setStreamingContent("");
    setCurrentAgent(null);
    setIsCurrentAgentForced(Boolean(forcedAgent));

    try {
      let forcedUsed = Boolean(forcedAgent);
      const history = messages.filter((m) => m.id !== "welcome").slice(-10).map((msg) => ({ role: msg.role, content: msg.content }));
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: outboundMessage, conversationHistory: history, stream: true, forcedAgent }),
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
              if (typeof parsed.forcedAgentUsed === "boolean") {
                forcedUsed = parsed.forcedAgentUsed;
                setIsCurrentAgentForced(parsed.forcedAgentUsed);
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
        metadata: agentUsed ? { agentUsed, forcedAgentUsed: forcedUsed } : undefined,
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      setStreamingContent("");
      await saveConversation(finalMessages);

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
      const failedMessages = [...newMessages, errorMessage];
      setMessages(failedMessages);
      await saveConversation(failedMessages);
    } finally {
      setIsLoading(false);
      setCurrentAgent(null);
      setIsCurrentAgentForced(false);
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
          void saveConversation(next);
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
    if (isCommandMenuOpen && commandSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCommandMenuIndex((prev) => (prev + 1) % commandSuggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCommandMenuIndex((prev) => (prev - 1 + commandSuggestions.length) % commandSuggestions.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        applyCommandCompletion(commandSuggestions[commandMenuIndex]);
        return;
      }
    }

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

      {/* Messages */}
      {showWelcome ? (
        <WelcomeScreen />
      ) : (
        <ScrollArea className="flex-1 pt-6 pb-28">
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
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wider px-1.5 py-0.5 rounded border border-current/30">
                            <span>{message.metadata.agentUsed}</span>
                            {message.metadata.forcedAgentUsed && (
                              <span className="px-1 py-0.5 rounded border border-current/40 text-[9px]">forced</span>
                            )}
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
                    {currentAgent && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wider">
                        <span>{currentAgent}</span>
                        {isCurrentAgentForced && (
                          <span className="px-1 py-0.5 rounded border border-current/40 text-[9px]">forced</span>
                        )}
                      </span>
                    )}
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
          {isCommandMenuOpen && (
            <div className="mb-2 rounded-xl border border-border/60 bg-card/95 backdrop-blur-md shadow-xl overflow-hidden">
              {commandSuggestions.length > 0 ? (
                <div className="max-h-56 overflow-y-auto p-1.5">
                  {commandSuggestions.map((cmd, idx) => (
                    <button
                      key={cmd.key}
                      type="button"
                      className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${
                        idx === commandMenuIndex ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/60"
                      }`}
                      onClick={() => applyCommandCompletion(cmd)}
                    >
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-semibold text-primary">/{cmd.key}</code>
                        <span className="text-xs text-foreground">{cmd.title}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{cmd.description}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-2.5 text-xs text-muted-foreground">
                  未找到命令，输入 <code>/help</code> 查看可用指令
                </div>
              )}
            </div>
          )}
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
              data-voice-local="true"
              placeholder="输入消息，或使用 /jd /resume /interview 等指令..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              className="flex-1 min-h-[52px] max-h-[160px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 py-3.5 px-2 text-base font-medium placeholder:text-muted-foreground/60"
            />
            {isVoiceSupported && (
              <Button
                onClick={isListening ? stopListening : startListening}
                variant="ghost"
                size="icon"
                className={`h-12 w-12 shrink-0 rounded-xl transition-colors mb-0.5 ${
                  isListening
                    ? "bg-red-500/15 text-red-500 hover:bg-red-500/20"
                    : "hover:bg-primary/10 hover:text-primary"
                }`}
                title={isListening ? "停止语音输入" : "开始语音输入"}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
            )}
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
              支持拖拽文档 · Ctrl+Enter 发送 · 输入 / 触发指令菜单
            </p>
            {isCommandMenuOpen && commandSuggestions[commandMenuIndex] && (
              <p className="text-[10px] font-medium text-primary/80 mt-1 truncate px-4">
                参数提示：/{commandSuggestions[commandMenuIndex].key} {commandSuggestions[commandMenuIndex].placeholder}
              </p>
            )}
            {isListening && (
              <p className="text-[10px] font-medium text-primary/80 mt-1 truncate px-4">
                正在语音识别：{interimText || "请开始说话..."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
