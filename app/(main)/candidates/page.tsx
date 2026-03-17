"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, Upload, Search, Loader2, FileText, Sparkles, Trash2, RefreshCw, Check,
} from "lucide-react";
import { toast } from "sonner";
import type { Candidate, Job } from "@/lib/types";

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  pending: { label: "待筛选", dot: "bg-muted-foreground", bg: "bg-muted", text: "text-muted-foreground" },
  screening: { label: "筛选中", dot: "bg-blue-500", bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  interview: { label: "面试中", dot: "bg-purple-500", bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400" },
  offered: { label: "已发Offer", dot: "bg-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  hired: { label: "已录用", dot: "bg-green-500", bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400" },
  rejected: { label: "已淘汰", dot: "bg-red-500", bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400" },
};

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [analyzing, setAnalyzing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchingAll, setMatchingAll] = useState(false);
  const [batchMatching, setBatchMatching] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<"single" | "batch">("single");
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    try {
      const [candRes, jobsRes] = await Promise.all([
        fetch("/api/candidates").then((r) => r.json()),
        fetch("/api/jobs").then((r) => r.json()),
      ]);
      setCandidates(candRes.candidates || []);
      setJobs(jobsRes.jobs || []);
    } catch { toast.error("加载数据失败"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleAnalyze = async (id: string) => {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/candidates/${id}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("AI分析完成");
      setSelectedCandidate(data);
      loadData();
    } catch (err) { toast.error(err instanceof Error ? err.message : "分析失败"); }
    finally { setAnalyzing(false); }
  };

  const handleMatch = async (candidateId: string, jobId: string) => {
    setMatching(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/match`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("匹配完成");
      setSelectedCandidate(data);
      loadData();
    } catch (err) { toast.error(err instanceof Error ? err.message : "匹配失败"); }
    finally { setMatching(false); }
  };

  const handleMatchAll = async (candidateId: string) => {
    setMatchingAll(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/match-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`已匹配 ${data.matchCount} 个职位`);
      loadData();
      if (selectedCandidate?.id === candidateId) {
        setSelectedCandidate(data.candidate);
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "批量匹配失败"); }
    finally { setMatchingAll(false); }
  };

  const handleBatchMatchAll = async () => {
    const targets = candidates.filter(c => ["pending", "screening", "interview"].includes(c.status));
    if (targets.length === 0) { toast.info("没有需要匹配的候选人"); return; }
    setBatchMatching(true);
    setBatchProgress({ done: 0, total: targets.length });
    let succeeded = 0;
    for (const c of targets) {
      try {
        const res = await fetch(`/api/candidates/${c.id}/match-all`, {
          method: "POST", headers: { "Content-Type": "application/json" },
        });
        if (res.ok) succeeded++;
      } catch {}
      setBatchProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }
    setBatchMatching(false);
    toast.success(`批量匹配完成：${succeeded}/${targets.length} 成功`);
    loadData();
  };

  const getTopScore = (c: Candidate): number => {
    if (!c.matchedJobs?.length) return -1;
    return Math.max(...c.matchedJobs.map(m => m.score));
  };

  const getTopJobTitle = (c: Candidate): string | null => {
    if (!c.matchedJobs?.length) return null;
    const top = c.matchedJobs.reduce((a, b) => a.score > b.score ? a : b);
    return top.jobTitle || null;
  };

  const matchedJobTitles = Array.from(new Set(
    candidates.flatMap(c => c.matchedJobs?.map(m => m.jobTitle).filter(Boolean) || [])
  )) as string[];

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch("/api/candidates", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) { toast.success("状态已更新"); loadData(); }
  };

  const handleDelete = async (id?: string) => {
    if (id) {
      setDeleteType("single");
      setSelectedCandidate(candidates.find(c => c.id === id) || null);
    } else {
      setDeleteType("batch");
    }
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const idsToDelete = deleteType === "single" && selectedCandidate ? [selectedCandidate.id] : Array.from(selectedIds);

      const results = await Promise.allSettled(
        idsToDelete.map(id => fetch(`/api/candidates?id=${id}`, { method: "DELETE" }))
      );

      const succeeded = results.filter(r => r.status === "fulfilled" && (r.value as Response).ok).length;
      const failed = idsToDelete.length - succeeded;

      if (succeeded > 0) {
        toast.success(`成功删除 ${succeeded} 个候选人${failed > 0 ? `，${failed} 个失败` : ""}`);
        await loadData();
        setSelectedCandidate(null);
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
      setSelectedIds(new Set(filtered.map(c => c.id)));
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

  const handleCardClick = (candidate: Candidate, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("input[type='checkbox']")) {
      return;
    }
    setSelectedCandidate(candidate);
  };

  const handleUploaded = (newCandidate?: Candidate) => {
    setIsUploadOpen(false);
    loadData();
    if (newCandidate) setSelectedCandidate(newCandidate);
  };

  const filtered = candidates.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (scoreFilter !== "all") {
      const top = getTopScore(c);
      if (scoreFilter === "80+" && top < 80) return false;
      if (scoreFilter === "60-80" && (top < 60 || top >= 80)) return false;
      if (scoreFilter === "60-" && (top >= 60 || top < 0)) return false;
      if (scoreFilter === "none" && top >= 0) return false;
    }
    if (jobFilter !== "all") {
      if (!c.matchedJobs?.some(m => m.jobTitle === jobFilter)) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.contact?.email ?? "").toLowerCase().includes(q) ||
        c.resume?.parsedData?.skills?.some((s) => s.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="flex h-full min-h-0">
      <div className="w-96 border-r border-border/40 bg-muted/10 flex flex-col min-h-0 overflow-hidden">
        <div className="p-4 border-b border-border/40 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold flex items-center gap-2"><Users className="w-5 h-5" />候选人</h1>
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Upload className="w-4 h-4 mr-1" />添加简历</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>添加简历</DialogTitle></DialogHeader>
                <ResumeDropZone onUploaded={handleUploaded} />
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="搜索候选人..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待筛选</SelectItem>
                <SelectItem value="screening">筛选中</SelectItem>
                <SelectItem value="interview">面试中</SelectItem>
                <SelectItem value="offered">已发Offer</SelectItem>
                <SelectItem value="hired">已录用</SelectItem>
                <SelectItem value="rejected">已淘汰</SelectItem>
              </SelectContent>
            </Select>
            <Select value={scoreFilter} onValueChange={setScoreFilter}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部评分</SelectItem>
                <SelectItem value="80+">80分以上</SelectItem>
                <SelectItem value="60-80">60-80分</SelectItem>
                <SelectItem value="60-">60分以下</SelectItem>
                <SelectItem value="none">未匹配</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {matchedJobTitles.length > 0 && (
            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部职位</SelectItem>
                {matchedJobTitles.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button
            size="sm" variant="outline" className="w-full"
            onClick={handleBatchMatchAll}
            disabled={batchMatching}
          >
            {batchMatching ? (
              <><Loader2 className="w-3 h-3 mr-1 animate-spin" />匹配中 {batchProgress.done}/{batchProgress.total}</>
            ) : (
              <><Sparkles className="w-3 h-3 mr-1" />一键匹配所有候选人</>
            )}
          </Button>
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
            {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div> :
             filtered.length === 0 ? <p className="text-center text-muted-foreground py-8">暂无候选人</p> :
             filtered.map((c) => {
              const topScore = getTopScore(c);
              const topJob = getTopJobTitle(c);
              const scoreColor = topScore >= 80 ? "text-green-600" : topScore >= 60 ? "text-amber-600" : topScore >= 0 ? "text-red-500" : "text-muted-foreground";
              const scoreBg = topScore >= 80 ? "bg-green-50 dark:bg-green-950/50" : topScore >= 60 ? "bg-amber-50 dark:bg-amber-950/50" : "";
              return (
              <Card
                key={c.id}
                className={`p-3.5 cursor-pointer transition-all duration-300 border hover:shadow-md hover:-translate-y-0.5 ${
                  selectedCandidate?.id === c.id ? "border-primary bg-primary/5 shadow-sm" : "border-border/50 hover:border-primary/30"
                } ${scoreBg}`}
                onClick={(e) => handleCardClick(c, e)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => handleSelectOne(c.id)}
                    className="mt-1 w-4 h-4 rounded border-border cursor-pointer transition-colors checked:bg-primary"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex items-start justify-between mb-1 flex-1 min-w-0">
                    <div className="flex-1 min-w-0 pr-2">
                    <p className="font-semibold text-sm truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate font-medium">{c.resume?.parsedData?.skills?.slice(0, 3).join(" · ") || "待分析"}</p>
                    {topScore >= 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="outline" className={`text-[10px] h-4 px-1.5 border-0 bg-background/50 ${scoreColor}`}>
                          {topScore} 分
                        </Badge>
                        {topJob && <span className="text-[10px] text-muted-foreground truncate">{topJob}</span>}
                      </div>
                    )}
                  </div>
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border-0 ${STATUS_CONFIG[c.status]?.bg || "bg-muted"} ${STATUS_CONFIG[c.status]?.text || "text-muted-foreground"} shrink-0`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[c.status]?.dot || "bg-muted-foreground"}`} />
                    <span className="text-[10px] font-semibold">{STATUS_CONFIG[c.status]?.label || c.status}</span>
                  </div>
                </div>
                </div>
              </Card>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {selectedCandidate ? (
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">{selectedCandidate.name}</h2>
                  <div className="text-sm text-muted-foreground space-x-3">
                    {selectedCandidate.contact?.email && <span>{selectedCandidate.contact.email}</span>}
                    {selectedCandidate.contact?.phone && <span>{selectedCandidate.contact.phone}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedCandidate.status} onValueChange={(v) => handleStatusChange(selectedCandidate.id, v)}>
                    <SelectTrigger className={`w-32 h-8 rounded-full border-0 ${STATUS_CONFIG[selectedCandidate.status]?.bg || "bg-muted"} ${STATUS_CONFIG[selectedCandidate.status]?.text || "text-muted-foreground"}`}>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[selectedCandidate.status]?.dot || "bg-muted-foreground"}`} />
                        <span className="text-xs font-semibold">{STATUS_CONFIG[selectedCandidate.status]?.label || selectedCandidate.status}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">待筛选</SelectItem>
                      <SelectItem value="screening">筛选中</SelectItem>
                      <SelectItem value="interview">面试中</SelectItem>
                      <SelectItem value="offered">已发Offer</SelectItem>
                      <SelectItem value="hired">已录用</SelectItem>
                      <SelectItem value="rejected">已淘汰</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(selectedCandidate.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleAnalyze(selectedCandidate.id)} disabled={analyzing}>
                  {analyzing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}AI重新分析
                </Button>
                <Select onValueChange={(jobId) => handleMatch(selectedCandidate.id, jobId)} disabled={matching}>
                  <SelectTrigger className="w-40"><SelectValue placeholder={matching ? "匹配中..." : "匹配职位"} /></SelectTrigger>
                  <SelectContent>{jobs.filter((j) => j.status === "active").map((j) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}</SelectContent>
                </Select>
                <Button
                  size="sm" variant="outline"
                  onClick={() => handleMatchAll(selectedCandidate.id)}
                  disabled={matchingAll}
                  className="shrink-0"
                >
                  {matchingAll ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                  {matchingAll ? "匹配中..." : "智能匹配全部"}
                </Button>
              </div>

              <Tabs defaultValue="info">
                <TabsList><TabsTrigger value="info">基本信息</TabsTrigger><TabsTrigger value="match">匹配结果</TabsTrigger></TabsList>
                <TabsContent value="info" className="space-y-4 mt-4">
                  {selectedCandidate.resume?.parsedData?.summary && (
                    <div><h3 className="font-semibold text-sm mb-1">简历摘要</h3><p className="text-sm text-muted-foreground">{selectedCandidate.resume?.parsedData?.summary}</p></div>
                  )}
                  {(selectedCandidate.resume?.parsedData?.skills?.length ?? 0) > 0 && (
                    <div><h3 className="font-semibold text-sm mb-1">技能</h3><div className="flex flex-wrap gap-1">{selectedCandidate.resume?.parsedData?.skills?.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}</div></div>
                  )}
                  {(selectedCandidate.resume?.parsedData?.experience?.length ?? 0) > 0 && (
                    <div><h3 className="font-semibold text-sm mb-2">工作经历</h3>
                      {selectedCandidate.resume?.parsedData?.experience?.map((exp, i) => (
                        <div key={i} className="mb-3"><p className="text-sm font-medium">{exp.position} @ {exp.company}</p><p className="text-xs text-muted-foreground">{exp.duration}</p><p className="text-xs mt-1">{exp.description}</p></div>
                      ))}
                    </div>
                  )}
                  {(selectedCandidate.resume?.parsedData?.education?.length ?? 0) > 0 && (
                    <div><h3 className="font-semibold text-sm mb-2">教育背景</h3>
                      {selectedCandidate.resume?.parsedData?.education?.map((edu, i) => (
                        <p key={i} className="text-sm">{edu.school} · {edu.degree} {edu.major}</p>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="match" className="space-y-3 mt-4">
                  {selectedCandidate.matchedJobs?.length > 0 ? selectedCandidate.matchedJobs.map((m, i) => (
                    <Card key={i} className="p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{m.jobTitle || m.jobId}</span>
                        <Badge variant="outline" className={`border-0 ${
                          m.score >= 80 ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                          m.score >= 60 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                          "bg-muted text-muted-foreground"
                        }`}>{m.score}分</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{m.reason}</p>
                      {((m.pros?.length ?? 0) > 0 || (m.cons?.length ?? 0) > 0) && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {(m.pros?.length ?? 0) > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold text-green-600">优势</p>
                              {m.pros!.map((p, pi) => (
                                <p key={pi} className="text-[11px] text-muted-foreground">+ {p}</p>
                              ))}
                            </div>
                          )}
                          {(m.cons?.length ?? 0) > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold text-orange-600">风险</p>
                              {m.cons!.map((c, ci) => (
                                <p key={ci} className="text-[11px] text-muted-foreground">- {c}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  )) : <p className="text-sm text-muted-foreground">暂无匹配结果，请选择职位进行匹配</p>}
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary/50" />
              </div>
              <p>选择候选人查看详情</p>
              <p className="text-sm mt-1">或点击"添加简历"直接拖入文件</p>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={deleteType === "single" ? "删除候选人" : "批量删除候选人"}
        description={
          deleteType === "single"
            ? `确定要删除候选人"${selectedCandidate?.name}"吗？此操作无法撤销。`
            : `确定要删除选中的 ${selectedIds.size} 个候选人吗？此操作无法撤销。`
        }
        confirmLabel={deleting ? "删除中..." : "确定删除"}
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  );
}

function ResumeDropZone({ onUploaded }: { onUploaded: (newCandidate?: Candidate) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [results, setResults] = useState<Array<{ name: string; success: boolean; message: string }>>([]);
  const [lastCandidate, setLastCandidate] = useState<Candidate | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File): Promise<Candidate | null> => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/candidates/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Trigger automatic AI analysis
      const analyzeRes = await fetch(`/api/candidates/${data.id}/analyze`, { method: "POST" });
      const analyzed = analyzeRes.ok ? await analyzeRes.json() : data;

      setResults((prev) => [...prev, {
        name: analyzed.name || file.name,
        success: true,
        message: `技能: ${analyzed.resume?.parsedData?.skills?.slice(0, 3).join(", ") || "待分析"}`,
      }]);
      return analyzed;
    } catch (err) {
      setResults((prev) => [...prev, { name: file.name, success: false, message: err instanceof Error ? err.message : "上传失败" }]);
      return null;
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    setUploading(true);
    let latest: Candidate | null = null;
    for (const file of Array.from(files)) {
      const c = await uploadFile(file);
      if (c) latest = c;
    }
    setLastCandidate(latest ?? null);
    setUploading(false);
    toast.success(`${Array.from(files).length}份简历已处理`);
  };

  const handleTextSubmit = async () => {
    if (!pasteText.trim()) return;
    setUploading(true);
    try {
      const res = await fetch("/api/candidates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: pasteText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Trigger automatic AI analysis
      const analyzeRes = await fetch(`/api/candidates/${data.id}/analyze`, { method: "POST" });
      const analyzed = analyzeRes.ok ? await analyzeRes.json() : data;

      setResults((prev) => [...prev, {
        name: analyzed.name,
        success: true,
        message: `技能: ${analyzed.resume?.parsedData?.skills?.slice(0, 3).join(", ") || "待分析"}`,
      }]);
      setLastCandidate(analyzed);
      setPasteText("");
      toast.success("简历已添加");
    } catch (err) { toast.error(err instanceof Error ? err.message : "添加失败"); }
    finally { setUploading(false); }
  };

  const handleDone = () => {
    onUploaded(lastCandidate ?? undefined);
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer group ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".pdf,.txt,.doc,.docx" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
        <Upload className={`w-10 h-10 mx-auto mb-3 transition-transform duration-300 group-hover:scale-110 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
        <p className="font-medium">{isDragging ? "松开上传" : "拖拽简历文件到这里"}</p>
        <p className="text-sm text-muted-foreground mt-1">支持 PDF、TXT 格式，可批量上传</p>
        {uploading && <div className="flex items-center justify-center gap-2 mt-3"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">处理中...</span></div>}
      </div>

      <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center"><span className="bg-background px-2 text-xs text-muted-foreground">或者粘贴简历文本</span></div></div>

      <Textarea
        placeholder="直接粘贴简历内容，AI 会自动提取姓名、联系方式、经历等信息..."
        value={pasteText}
        onChange={(e) => setPasteText(e.target.value)}
        className="min-h-[100px]"
      />
      {pasteText.trim() && (
        <Button onClick={handleTextSubmit} disabled={uploading} className="w-full">
          {uploading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />分析中...</> : <><Sparkles className="w-4 h-4 mr-1" />AI 分析并添加</>}
        </Button>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">处理结果</p>
          {results.map((r, i) => (
            <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${r.success ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}`}>
              {r.success ? <FileText className="w-4 h-4 text-green-600" /> : <span className="text-red-600">✗</span>}
              <span className="font-medium">{r.name}</span>
              <span className="text-muted-foreground text-xs">{r.message}</span>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={handleDone}>完成</Button>
        </div>
      )}
    </div>
  );
}
