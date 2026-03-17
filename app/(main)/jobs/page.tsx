"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Briefcase, Plus, Search, Loader2, Sparkles, Trash2, Edit, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import type { Job } from "@/lib/types";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "招聘中", variant: "default" },
  draft: { label: "草稿", variant: "outline" },
  paused: { label: "暂停", variant: "secondary" },
  closed: { label: "已关闭", variant: "destructive" },
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadJobs = async () => {
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch { toast.error("加载职位失败"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadJobs(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此职位？")) return;
    const res = await fetch(`/api/jobs?id=${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("已删除"); loadJobs(); setSelectedJob(null); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch("/api/jobs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) { toast.success("状态已更新"); loadJobs(); }
  };

  const filtered = jobs.filter((j) => {
    if (statusFilter !== "all" && j.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return j.title.toLowerCase().includes(q) || j.department.toLowerCase().includes(q) || j.skills?.some((s) => s.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="flex h-full min-h-0">
      <div className="w-96 border-r border-border flex flex-col min-h-0 overflow-hidden">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold flex items-center gap-2"><Briefcase className="w-5 h-5" />职位管理</h1>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" />发布职位</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>智能发布职位</DialogTitle></DialogHeader>
                <SmartJobCreator onCreated={() => { setIsCreateOpen(false); loadJobs(); }} />
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="搜索职位..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="active">招聘中</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="paused">暂停</SelectItem>
              <SelectItem value="closed">已关闭</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">暂无职位</p>
            ) : filtered.map((job) => (
              <Card
                key={job.id}
                className={`p-3 cursor-pointer hover:bg-accent transition-all duration-200 transition-colors ${selectedJob?.id === job.id ? "bg-accent" : ""}`}
                onClick={() => setSelectedJob(job)}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.department}</p>
                    {job.skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1">{job.skills.slice(0, 3).map((s) => <Badge key={s} variant="outline" className="text-[10px] h-4">{s}</Badge>)}</div>
                    )}
                  </div>
                  <Badge variant={STATUS_CONFIG[job.status]?.variant || "outline"} className="text-[10px] shrink-0 ml-2">
                    {STATUS_CONFIG[job.status]?.label || job.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {selectedJob ? (
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">{selectedJob.title}</h2>
                  <p className="text-muted-foreground">{selectedJob.department} · {selectedJob.level}</p>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedJob.status} onValueChange={(v) => handleStatusChange(selectedJob.id, v)}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">招聘中</SelectItem>
                      <SelectItem value="draft">草稿</SelectItem>
                      <SelectItem value="paused">暂停</SelectItem>
                      <SelectItem value="closed">已关闭</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(selectedJob.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              {selectedJob.salary && (
                <p className="text-lg font-semibold text-primary">{selectedJob.salary.min}-{selectedJob.salary.max}K</p>
              )}
              {selectedJob.skills?.length > 0 && (
                <div className="flex flex-wrap gap-2">{selectedJob.skills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
              )}
              {selectedJob.description?.overview && (
                <div><h3 className="font-semibold mb-2">职位概述</h3><p className="text-sm text-muted-foreground">{selectedJob.description.overview}</p></div>
              )}
              {selectedJob.description?.responsibilities?.length > 0 && (
                <div><h3 className="font-semibold mb-2">岗位职责</h3><ul className="text-sm text-muted-foreground space-y-1">{selectedJob.description.responsibilities.map((r, i) => <li key={i}>• {r}</li>)}</ul></div>
              )}
              {selectedJob.description?.requirements?.length > 0 && (
                <div><h3 className="font-semibold mb-2">任职要求</h3><ul className="text-sm text-muted-foreground space-y-1">{selectedJob.description.requirements.map((r, i) => <li key={i}>• {r}</li>)}</ul></div>
              )}
              {selectedJob.description?.benefits?.length > 0 && (
                <div><h3 className="font-semibold mb-2">福利待遇</h3><ul className="text-sm text-muted-foreground space-y-1">{selectedJob.description.benefits.map((b, i) => <li key={i}>• {b}</li>)}</ul></div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-primary/50" />
              </div>
              <p>选择一个职位查看详情</p>
              <p className="text-sm mt-1">或点击"发布职位"智能创建</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SmartJobCreator({ onCreated }: { onCreated: () => void }) {
  const [freeText, setFreeText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<Job | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  const handleGenerate = async () => {
    if (!freeText.trim()) { toast.error("请输入职位描述"); return; }
    setGenerating(true);
    try {
      const res = await fetch("/api/jobs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeText: freeText.trim(), save: false }),
      });
      const data = await res.json();
      if (data.needManualInput) {
        toast.info("需要手动粘贴", { description: data.suggestion, duration: 10000 });
        if (data.originalUrl) {
          window.open(data.originalUrl, "_blank");
        }
        setGenerating(false);
        return;
      }
      if (!res.ok) throw new Error(data.error);
      setPreview(data.job);
      setEditData(data.job);
      toast.success("JD已生成，请确认保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "生成失败");
    } finally { setGenerating(false); }
  };

  const handleSave = async () => {
    const jobData = editData || preview;
    if (!jobData) return;
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: jobData.title,
          level: jobData.level || "mid",
          department: jobData.department || "未指定",
          skills: jobData.skills || [],
          description: jobData.description,
          salary: jobData.salary,
          status: "active",
        }),
      });
      if (!res.ok) throw new Error("保存失败");
      toast.success("职位已发布");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    }
  };

  return (
    <div className="space-y-4">
      {!preview ? (
        <>
          <div>
            <Label className="text-sm font-medium mb-2 block">描述你需要的职位</Label>
            <Textarea
              placeholder={'试试这样输入：\n• "招一个5年经验的Go后端，做微服务，25-40K，技术部"\n• 粘贴一段现有的JD文本\n• 粘贴招聘网站URL（如BOSS直聘、拉勾）'}
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              className="min-h-[150px]"
            />
          </div>
          <Button onClick={handleGenerate} disabled={generating || !freeText.trim()} className="w-full gradient-primary text-white">
            {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />AI 解析生成中...</> : <><Sparkles className="w-4 h-4 mr-2" />AI 智能生成 JD</>}
          </Button>
        </>
      ) : (
        <>
          <Card className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold">{preview.title}</h3>
                <p className="text-sm text-muted-foreground">{preview.department} · {preview.level}</p>
              </div>
              {preview.salary && <Badge variant="secondary">{preview.salary.min}-{preview.salary.max}K</Badge>}
            </div>
            {preview.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1">{preview.skills.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}</div>
            )}
            {preview.description?.overview && <p className="text-sm">{preview.description.overview}</p>}
            {preview.description?.responsibilities?.length > 0 && (
              <div><p className="text-xs font-semibold mb-1">岗位职责</p>{preview.description.responsibilities.map((r, i) => <p key={i} className="text-xs text-muted-foreground">• {r}</p>)}</div>
            )}
            {preview.description?.requirements?.length > 0 && (
              <div><p className="text-xs font-semibold mb-1">任职要求</p>{preview.description.requirements.map((r, i) => <p key={i} className="text-xs text-muted-foreground">• {r}</p>)}</div>
            )}
          </Card>

          <Button variant="ghost" size="sm" onClick={() => setShowAdvanced(!showAdvanced)} className="w-full">
            {showAdvanced ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
            {showAdvanced ? "收起编辑" : "展开编辑"}
          </Button>

          {showAdvanced && editData && (
            <div className="space-y-3 border-t pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">职位名称</Label><Input value={editData.title || ""} onChange={(e) => setEditData({ ...editData, title: e.target.value })} /></div>
                <div><Label className="text-xs">部门</Label><Input value={editData.department || ""} onChange={(e) => setEditData({ ...editData, department: e.target.value })} /></div>
                <div><Label className="text-xs">级别</Label>
                  <Select value={editData.level || "mid"} onValueChange={(v) => setEditData({ ...editData, level: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="junior">初级</SelectItem><SelectItem value="mid">中级</SelectItem>
                      <SelectItem value="senior">高级</SelectItem><SelectItem value="expert">专家</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">技能 (逗号分隔)</Label><Input value={(editData.skills || []).join(", ")} onChange={(e) => setEditData({ ...editData, skills: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} /></div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setPreview(null); setEditData(null); }}>重新生成</Button>
            <Button className="flex-1" onClick={handleSave}><Sparkles className="w-4 h-4 mr-1" />确认发布</Button>
          </div>
        </>
      )}
    </div>
  );
}
