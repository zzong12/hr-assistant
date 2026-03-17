"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Database, Download, Trash2, Info, Loader2, Bell, Send, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

interface DataStats {
  jobs: number;
  candidates: number;
  interviews: number;
  conversations: number;
  templates: number;
}

export default function SettingsPage() {
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [stats, setStats] = useState<DataStats>({ jobs: 0, candidates: 0, interviews: 0, conversations: 0, templates: 0 });
  const [feishuUrl, setFeishuUrl] = useState("");
  const [feishuEnabled, setFeishuEnabled] = useState(true);
  const [feishuAppId, setFeishuAppId] = useState("");
  const [feishuAppSecret, setFeishuAppSecret] = useState("");
  const [feishuVerifyToken, setFeishuVerifyToken] = useState("");
  const [savingNotify, setSavingNotify] = useState(false);
  const [savingApp, setSavingApp] = useState(false);
  const [testingNotify, setTestingNotify] = useState(false);

  useEffect(() => {
    fetch("/api/data")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {});
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setFeishuUrl(data.feishu_webhook_url || "");
        setFeishuEnabled(data.feishu_notify_enabled !== "false");
        setFeishuAppId(data.feishu_app_id || "");
        setFeishuAppSecret(data.feishu_app_secret || "");
        setFeishuVerifyToken(data.feishu_verification_token || "");
      })
      .catch(() => {});
  }, []);

  const handleSaveNotify = async () => {
    setSavingNotify(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feishu_webhook_url: feishuUrl,
          feishu_notify_enabled: feishuEnabled ? "true" : "false",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("通知配置已保存");
    } catch { toast.error("保存失败"); }
    finally { setSavingNotify(false); }
  };

  const handleSaveFeishuApp = async () => {
    setSavingApp(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feishu_app_id: feishuAppId,
          feishu_app_secret: feishuAppSecret,
          feishu_verification_token: feishuVerifyToken,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("飞书应用配置已保存");
    } catch { toast.error("保存失败"); }
    finally { setSavingApp(false); }
  };

  const handleTestNotify = async () => {
    setTestingNotify(true);
    try {
      const res = await fetch("/api/notify", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("测试通知已发送");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "发送失败，请检查Webhook地址");
    } finally { setTestingNotify(false); }
  };

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export" }),
      });
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hr-assistant-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("数据导出成功");
    } catch { toast.error("导出失败"); }
    finally { setExporting(false); }
  };

  const handleClearData = async () => {
    if (!confirm("确定要清除所有数据吗？此操作不可撤销！")) return;
    if (!confirm("再次确认：这将删除所有职位、候选人、面试和对话数据！")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      if (!res.ok) throw new Error("清除服务端数据失败");
      localStorage.removeItem("hr-assistant-storage");
      toast.success("数据已清除");
      window.location.reload();
    } catch { toast.error("清除失败"); }
    finally { setClearing(false); }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-6 border-b border-border/40 glass">
        <h1 className="text-xl font-bold gradient-text">系统设置</h1>
        <p className="text-xs text-muted-foreground mt-1">配置通知、数据管理和系统参数</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-8 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Feishu Notification */}
          <Card className="p-8 border-border/40 h-fit shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">飞书通知</h2>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">飞书机器人 Webhook 地址</Label>
                <Input
                  placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
                  value={feishuUrl}
                  onChange={(e) => setFeishuUrl(e.target.value)}
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">在飞书群中添加自定义机器人后获取 Webhook 地址</p>
              </div>
              <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-xl border border-border/40">
                <input
                  type="checkbox"
                  id="feishu-enabled"
                  checked={feishuEnabled}
                  onChange={(e) => setFeishuEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="feishu-enabled" className="text-sm font-medium">启用飞书通知</Label>
                  <p className="text-[11px] text-muted-foreground">简历分析完成、JD生成完成、面试安排确认、面试反馈提交、候选人状态变更</p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSaveNotify} disabled={savingNotify} className="flex-1">
                  {savingNotify ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}保存配置
                </Button>
                <Button variant="outline" onClick={handleTestNotify} disabled={testingNotify || !feishuUrl} className="flex-1">
                  {testingNotify ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}测试通知
                </Button>
              </div>
            </div>
          </Card>

          {/* Feishu Bidirectional */}
          <Card className="p-8 border-border/40 h-fit shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">飞书双向通信</h2>
            </div>
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground leading-relaxed bg-primary/5 p-3 rounded-xl border border-primary/10">
                配置飞书自建应用，实现在飞书群中直接与 Nexus 对话。需要在飞书开放平台创建自建应用并开启机器人能力。
              </p>
              <div className="space-y-2">
                <Label className="text-sm font-medium">App ID</Label>
                <Input placeholder="cli_xxxxxxxx" value={feishuAppId} onChange={(e) => setFeishuAppId(e.target.value)} className="font-mono h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">App Secret</Label>
                <Input placeholder="xxxxxxxx" type="password" value={feishuAppSecret} onChange={(e) => setFeishuAppSecret(e.target.value)} className="font-mono h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Verification Token <span className="text-muted-foreground font-normal">(可选)</span></Label>
                <Input placeholder="用于验证请求来源" value={feishuVerifyToken} onChange={(e) => setFeishuVerifyToken(e.target.value)} className="font-mono h-10" />
              </div>
              <div className="bg-muted/40 rounded-xl p-4 border border-border/40 space-y-1.5">
                <p className="text-sm font-medium">Webhook 回调地址</p>
                <code className="block text-xs text-primary bg-primary/10 p-2 rounded-lg break-all select-all">
                  {typeof window !== "undefined" ? window.location.origin : ""}/api/feishu/webhook
                </code>
                <p className="text-[11px] text-muted-foreground">在飞书开放平台的"事件订阅"中填写此地址</p>
              </div>
              <div className="pt-2">
                <Button onClick={handleSaveFeishuApp} disabled={savingApp} className="w-full">
                  {savingApp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}保存应用配置
                </Button>
              </div>
            </div>
          </Card>

          {/* Data Management */}
          <Card className="p-8 border-border/40 h-fit shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">数据管理</h2>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors">
                  <div className="text-3xl font-black gradient-text mb-1">{stats.jobs}</div>
                  <div className="text-xs font-medium text-muted-foreground">职位数量</div>
                </div>
                <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors">
                  <div className="text-3xl font-black gradient-text mb-1">{stats.candidates}</div>
                  <div className="text-xs font-medium text-muted-foreground">候选人</div>
                </div>
                <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors">
                  <div className="text-3xl font-black gradient-text mb-1">{stats.interviews}</div>
                  <div className="text-xs font-medium text-muted-foreground">面试安排</div>
                </div>
                <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors">
                  <div className="text-3xl font-black gradient-text mb-1">{stats.conversations}</div>
                  <div className="text-xs font-medium text-muted-foreground">对话记录</div>
                </div>
              </div>
              <Separator className="bg-border/50" />
              <div className="flex gap-4">
                <Button variant="outline" onClick={handleExportAll} disabled={exporting} className="flex-1 h-11">
                  {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}备份数据
                </Button>
                <Button variant="destructive" onClick={handleClearData} disabled={clearing} className="flex-1 h-11">
                  {clearing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}清空数据
                </Button>
              </div>
            </div>
          </Card>

          {/* About */}
          <Card className="p-8 border-border/40 h-fit shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Info className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">关于</h2>
            </div>
            <div className="space-y-4 text-sm bg-muted/20 p-5 rounded-2xl border border-border/40">
              <div className="flex justify-between items-center py-1 border-b border-border/40 last:border-0"><span className="text-muted-foreground font-medium">应用名称</span><span className="font-semibold">Nexus HR</span></div>
              <div className="flex justify-between items-center py-1 border-b border-border/40 last:border-0"><span className="text-muted-foreground font-medium">版本</span><span className="font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-md text-xs">v2.0.0</span></div>
              <div className="flex justify-between items-center py-1 border-b border-border/40 last:border-0"><span className="text-muted-foreground font-medium">技术栈</span><span className="font-semibold">Next.js + Claude AI</span></div>
              <div className="flex justify-between items-center py-1 border-b border-border/40 last:border-0"><span className="text-muted-foreground font-medium">AI引擎</span><span className="font-semibold">Claude Sonnet</span></div>
              <div className="flex justify-between items-center py-1 border-b border-border/40 last:border-0"><span className="text-muted-foreground font-medium">数据存储</span><span className="font-semibold">SQLite + LocalStorage</span></div>
              <div className="flex justify-between items-center py-1"><span className="text-muted-foreground font-medium">通知渠道</span><span className="font-semibold">飞书机器人</span></div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mt-6 text-center">
              Nexus HR —— 您的 AI 数字员工。通过对话即可完成职位发布、简历分析、面试安排等全流程操作，支持后台自动处理和飞书主动通知。
            </p>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
