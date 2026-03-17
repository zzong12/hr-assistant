"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Briefcase, Plus, Search, Loader2, Sparkles, Trash2, Edit, ChevronDown, ChevronUp, Check, Users,
} from "lucide-react";
import { toast } from "sonner";
import type { Job, Candidate } from "@/lib/types";

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  active: { label: "招聘中", dot: "bg-green-500", bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400" },
  draft: { label: "草稿", dot: "bg-muted-foreground", bg: "bg-muted", text: "text-muted-foreground" },
  paused: { label: "暂停", dot: "bg-amber-500", bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
  closed: { label: "已关闭", dot: "bg-red-500", bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400" },
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<"single" | "batch">("single");
  const [deleting, setDeleting] = useState(false);

  const loadJobs = async () => {
    try {
      const [jobsRes, candidatesRes] = await Promise.all([
        fetch("/api/jobs"),
        fetch("/api/candidates")
      ]);
      const jobsData = await jobsRes.json();
      const candidatesData = await candidatesRes.json();
      setJobs(jobsData.jobs || []);
      setCandidates(candidatesData.candidates || []);
    } catch { toast.error("加载数据失败"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadJobs(); }, []);

  const handleDelete = async (id?: string) => {
    if (id) {
      setDeleteType("single");
      setSelectedJob(jobs.find(j => j.id === id) || null);
    } else {
      setDeleteType("batch");
    }
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const idsToDelete = deleteType === "single" && selectedJob ? [selectedJob.id] : Array.from(selectedIds);

      // Batch delete
      const results = await Promise.allSettled(
        idsToDelete.map(id => fetch(`/api/jobs?id=${id}`, { method: "DELETE" }))
      );

      const succeeded = results.filter(r => r.status === "fulfilled" && (r.value as Response).ok).length;
      const failed = idsToDelete.length - succeeded;

      if (succeeded > 0) {
        toast.success(`成功删除 ${succeeded} 个职位${failed > 0 ? `，${failed} 个失败` : ""}`);
        await loadJobs();
        setSelectedJob(null);
        setSelectedIds(new Set());
      }
      if (failed > 0 && succeeded === 0) {
        toast.error("删除失败");
      }
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(j => j.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleCardClick = (job: Job, e: React.MouseEvent) => {
    // Don't open detail if clicking on checkbox
    if ((e.target as HTMLElement).closest("input[type='checkbox']")) {
      return;
    }
    setSelectedJob(job);
  };

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch("/api/jobs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) { toast.success("状态已更新"); loadJobs(); }
  };

  const getMatchedCandidates = (jobId: string) => {
    return candidates
      .map(c => ({
        candidate: c,
        match: c.matchedJobs?.find(m => m.jobId === jobId)
      }))
      .filter(item => item.match !== undefined)
      .sort((a, b) => (b.match?.score || 0) - (a.match?.score || 0))
      .slice(0, 5);
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
      <div className="w-96 border-r border-border/40 bg-muted/10 flex flex-col min-h-0 overflow-hidden">
        <div className="p-4 border-b border-border/40 space-y-3">
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

        {selectedIds.size > 0 && (
          <div className="px-4 py-2 bg-primary/10 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium">已选 {selectedIds.size} 项</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={handleSelectAll}>
                {selectedIds.size === filtered.length ? "取消全选" : "全选"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDelete()}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />}
                批量删除
              </Button>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">暂无职位</p>
            ) : filtered.map((job) => (
              <Card
                key={job.id}
                className={`p-3.5 cursor-pointer transition-all duration-300 border hover:shadow-md hover:-translate-y-0.5 ${
                  selectedJob?.id === job.id ? "border-primary bg-primary/5 shadow-sm" : "border-border/50 hover:border-primary/30"
                }`}
                onClick={(e) => handleCardClick(job, e)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(job.id)}
                    onChange={() => handleSelectOne(job.id)}
                    className="mt-1 w-4 h-4 rounded border-border cursor-pointer transition-colors checked:bg-primary"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex items-start justify-between mb-1 flex-1 min-w-0">
                    <div className="space-y-1.5 min-w-0 flex-1 pr-2">
                    <p className="font-semibold text-sm truncate">{job.title}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">{job.department}</p>
                    {job.skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {job.skills.slice(0, 3).map((s) => (
                          <Badge key={s} variant="outline" className="text-[9px] h-4 px-1.5 bg-background/50 border-border/50 font-normal">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border-0 ${STATUS_CONFIG[job.status]?.bg || "bg-muted"} ${STATUS_CONFIG[job.status]?.text || "text-muted-foreground"} shrink-0`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[job.status]?.dot || "bg-muted-foreground"}`} />
                    <span className="text-[10px] font-semibold">{STATUS_CONFIG[job.status]?.label || job.status}</span>
                  </div>
                </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {selectedJob ? (
          <>
            {/* 左侧：职位详情 */}
            <div className="flex-1 overflow-y-auto border-r border-border">
              <div className="p-6 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedJob.title}</h2>
                    <p className="text-muted-foreground">{selectedJob.department} · {selectedJob.level}</p>
                  </div>
                  <div className="flex gap-2">
                    <Select value={selectedJob.status} onValueChange={(v) => handleStatusChange(selectedJob.id, v)}>
                      <SelectTrigger className={`w-32 h-8 rounded-full border-0 ${STATUS_CONFIG[selectedJob.status]?.bg || "bg-muted"} ${STATUS_CONFIG[selectedJob.status]?.text || "text-muted-foreground"}`}>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[selectedJob.status]?.dot || "bg-muted-foreground"}`} />
                          <span className="text-xs font-semibold">{STATUS_CONFIG[selectedJob.status]?.label || selectedJob.status}</span>
                        </div>
                      </SelectTrigger>
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
            </div>

            {/* 右侧：匹配的候选人 */}
            <div className="w-96 overflow-y-auto border-l border-border bg-muted/30">
              {(() => {
                const matchedCandidates = getMatchedCandidates(selectedJob.id);

                return (
                  <div className="sticky top-0">
                    <div className="p-4 border-b border-border bg-background">
                      <h3 className="font-semibold flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-primary" />
                        匹配的候选人
                      </h3>
                      {matchedCandidates.length > 0 && (
                        <Badge variant="secondary" className="ml-auto">{matchedCandidates.length} 位</Badge>
                      )}
                    </div>

                    <div className="p-4 space-y-3">
                      {matchedCandidates.length === 0 ? (
                        <div className="text-center py-8">
                          <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                          <p className="text-sm text-muted-foreground">暂无匹配候选人</p>
                          <p className="text-xs text-muted-foreground mt-1">请先在候选人页面进行匹配</p>
                        </div>
                      ) : (
                        matchedCandidates.map(({ candidate, match }) => {
                          const scoreColor = match!.score >= 80 ? "text-green-600 dark:text-green-400" :
                                           match!.score >= 60 ? "text-amber-600 dark:text-amber-400" : "text-red-500 dark:text-red-400";
                          const scoreBg = match!.score >= 80 ? "bg-green-100 dark:bg-green-900/30" :
                                        match!.score >= 60 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-red-100 dark:bg-red-900/30";

                          return (
                            <Card key={candidate.id} className={`p-4 ${scoreBg} border-l-4 ${match!.score >= 80 ? "border-green-500" : match!.score >= 60 ? "border-amber-500" : "border-red-500"}`}>
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm mb-1">{candidate.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{candidate.contact?.email || candidate.contact?.phone || ""}</p>
                                </div>
                                <div className={`text-2xl font-bold ${scoreColor}`}>
                                  {match!.score}
                                </div>
                              </div>

                              {match!.reason && (
                                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{match!.reason}</p>
                              )}

                              {((match!.pros?.length ?? 0) > 0 || (match!.cons?.length ?? 0) > 0) && (
                                <div className="space-y-2">
                                  {(match!.pros?.length ?? 0) > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">优势</p>
                                      <div className="space-y-1">
                                        {match!.pros!.slice(0, 3).map((p, i) => (
                                          <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                                            <span className="shrink-0 text-green-600">•</span>
                                            <span>{p}</span>
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {(match!.cons?.length ?? 0) > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-1">风险</p>
                                      <div className="space-y-1">
                                        {match!.cons!.slice(0, 3).map((c, i) => (
                                          <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                                            <span className="shrink-0 text-orange-600">•</span>
                                            <span>{c}</span>
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
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

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={deleteType === "single" ? "删除职位" : "批量删除职位"}
        description={
          deleteType === "single"
            ? `确定要删除职位"${selectedJob?.title}"吗？此操作无法撤销。`
            : `确定要删除选中的 ${selectedIds.size} 个职位吗？此操作无法撤销。`
        }
        confirmLabel={deleting ? "删除中..." : "确定删除"}
        onConfirm={confirmDelete}
        variant="destructive"
      />
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
