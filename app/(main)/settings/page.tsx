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
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold">系统设置</h1>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl mx-auto space-y-6">
          {/* Feishu Notification */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5" />
              <h2 className="text-lg font-semibold">飞书通知</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-sm">飞书机器人 Webhook 地址</Label>
                <Input
                  placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
                  value={feishuUrl}
                  onChange={(e) => setFeishuUrl(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">在飞书群中添加自定义机器人后获取 Webhook 地址</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="feishu-enabled"
                  checked={feishuEnabled}
                  onChange={(e) => setFeishuEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="feishu-enabled" className="text-sm">启用飞书通知</Label>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>通知事件：简历分析完成、JD生成完成、面试安排确认、面试反馈提交、候选人状态变更</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveNotify} disabled={savingNotify} size="sm">
                  {savingNotify ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}保存配置
                </Button>
                <Button variant="outline" onClick={handleTestNotify} disabled={testingNotify || !feishuUrl} size="sm">
                  {testingNotify ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}发送测试通知
                </Button>
              </div>
            </div>
          </Card>

          {/* Feishu Bidirectional */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5" />
              <h2 className="text-lg font-semibold">飞书双向通信</h2>
            </div>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                配置飞书自建应用，实现在飞书群中直接与小HR对话。需要在飞书开放平台创建自建应用并开启机器人能力。
              </p>
              <div>
                <Label className="text-sm">App ID</Label>
                <Input placeholder="cli_xxxxxxxx" value={feishuAppId} onChange={(e) => setFeishuAppId(e.target.value)} className="mt-1 font-mono" />
              </div>
              <div>
                <Label className="text-sm">App Secret</Label>
                <Input placeholder="xxxxxxxx" type="password" value={feishuAppSecret} onChange={(e) => setFeishuAppSecret(e.target.value)} className="mt-1 font-mono" />
              </div>
              <div>
                <Label className="text-sm">Verification Token</Label>
                <Input placeholder="可选，用于验证请求来源" value={feishuVerifyToken} onChange={(e) => setFeishuVerifyToken(e.target.value)} className="mt-1 font-mono" />
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs font-medium mb-1">Webhook 回调地址</p>
                <code className="text-xs text-primary">{typeof window !== "undefined" ? window.location.origin : ""}/api/feishu/webhook</code>
                <p className="text-xs text-muted-foreground mt-1">在飞书开放平台的"事件订阅"中填写此地址</p>
              </div>
              <Button onClick={handleSaveFeishuApp} disabled={savingApp} size="sm">
                {savingApp ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}保存应用配置
              </Button>
            </div>
          </Card>

          {/* Data Management */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5" />
              <h2 className="text-lg font-semibold">数据管理</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <Card className="p-3"><div className="text-2xl font-bold">{stats.jobs}</div><div className="text-xs text-muted-foreground">职位</div></Card>
                <Card className="p-3"><div className="text-2xl font-bold">{stats.candidates}</div><div className="text-xs text-muted-foreground">候选人</div></Card>
                <Card className="p-3"><div className="text-2xl font-bold">{stats.interviews}</div><div className="text-xs text-muted-foreground">面试</div></Card>
                <Card className="p-3"><div className="text-2xl font-bold">{stats.conversations}</div><div className="text-xs text-muted-foreground">对话</div></Card>
              </div>
              <Separator />
              <div className="flex gap-3 flex-wrap">
                <Button variant="outline" onClick={handleExportAll} disabled={exporting}>
                  {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}导出全部数据
                </Button>
                <Button variant="destructive" onClick={handleClearData} disabled={clearing}>
                  {clearing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}清除全部数据
                </Button>
              </div>
            </div>
          </Card>

          {/* About */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-5 h-5" />
              <h2 className="text-lg font-semibold">关于</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">应用名称</span><span>HR数字助手</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">版本</span><span>v2.0.0</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">技术栈</span><span>Next.js + Claude AI</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">AI引擎</span><span>Claude Sonnet</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">数据存储</span><span>SQLite + LocalStorage</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">通知渠道</span><span>飞书机器人</span></div>
            </div>
            <Separator className="my-4" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              HR数字助手 v2.0 —— 您的AI数字员工。通过对话即可完成职位发布、简历分析、面试安排等全流程操作，支持后台自动处理和飞书主动通知。
            </p>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
