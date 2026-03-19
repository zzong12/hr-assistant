"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Briefcase, Plus, Search, Loader2, Sparkles, Trash2, Edit, ChevronDown, ChevronUp, Users, ChevronRight, Eye, Filter, Target, Info,
} from "lucide-react";
import { toast } from "sonner";
import { CandidateDetailContent } from "@/components/CandidateDetailContent";
import type { Job, Candidate, JobMatch, ScoringRule, ScoringRuleSnapshot } from "@/lib/types";

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
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteRuleOpen, setIsDeleteRuleOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<"single" | "batch">("single");
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sheet state for candidate details
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<JobMatch | null>(null);

  // Candidate filter state
  const [candidateSearchQuery, setCandidateSearchQuery] = useState("");
  const [candidateScoreFilter, setCandidateScoreFilter] = useState<string>("all");
  const [candidateSortBy, setCandidateSortBy] = useState<string>("score");

  // Dimension filter state
  const [dimensionFilterId, setDimensionFilterId] = useState<string>("none");
  const [dimensionMinScore, setDimensionMinScore] = useState<string>("0");

  // Scoring snapshot dialog
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [viewingSnapshot, setViewingSnapshot] = useState<ScoringRuleSnapshot | null>(null);

  // Candidates sheet state
  const [candidatesSheetOpen, setCandidatesSheetOpen] = useState(false);

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

  const handleDeleteScoringRule = async () => {
    if (!selectedJob) return;

    try {
      const response = await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedJob.id,
          scoringRuleId: null,
        }),
      });

      if (response.ok) {
        toast.success("已解除评分参考关联");
        await loadJobs();
        const refreshed = jobs.find(j => j.id === selectedJob.id);
        if (refreshed) setSelectedJob(refreshed);
        setIsDeleteRuleOpen(false);
      }
    } catch (error) {
      console.error("解除评分参考关联失败:", error);
      toast.error("解除关联失败");
    }
  };

  const openCandidateSheet = (candidate: Candidate, match: JobMatch) => {
    setSelectedCandidate(candidate);
    setSelectedMatch(match);
    setSheetOpen(true);
  };

  const handleScheduleInterview = () => {
    // TODO: Open interview scheduling dialog
    toast.info("面试安排功能开发中");
  };

  const handleUpdateCandidateStatus = () => {
    // TODO: Open candidate status update dialog
    toast.info("状态更新功能开发中");
  };

  const handleViewResume = () => {
    if (selectedCandidate?.resume?.filepath) {
      // Open resume preview
      toast.info("简历预览功能开发中");
    } else {
      toast.error("该候选人暂无简历");
    }
  };

  const getScoreTextColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-red-500 dark:text-red-400";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-green-50 dark:bg-green-950/30";
    if (score >= 60) return "bg-amber-50 dark:bg-amber-950/30";
    return "bg-red-50 dark:bg-red-950/30";
  };

  const getScoreBorderColor = (score: number) => {
    if (score >= 80) return "border-green-500";
    if (score >= 60) return "border-amber-500";
    return "border-red-500";
  };

  const getMatchedCandidates = (jobId: string) => {
    let matched = candidates
      .map(c => ({
        candidate: c,
        match: c.matchedJobs?.find(m => m.jobId === jobId)
      }))
      .filter(item => item.match !== undefined);

    if (candidateSearchQuery.trim()) {
      const query = candidateSearchQuery.toLowerCase();
      matched = matched.filter(item =>
        item.candidate.name.toLowerCase().includes(query)
      );
    }

    if (candidateScoreFilter !== "all") {
      const minScore = parseInt(candidateScoreFilter);
      matched = matched.filter(item => (item.match?.score || 0) >= minScore);
    }

    // Dimension filter
    if (dimensionFilterId !== "none" && dimensionMinScore !== "0") {
      const minDimScore = parseInt(dimensionMinScore);
      matched = matched.filter(item => {
        const ds = item.match?.dimensionScores?.find(d => d.dimensionId === dimensionFilterId);
        return ds ? ds.score >= minDimScore : false;
      });
    }

    // Sort
    matched.sort((a, b) => {
      if (candidateSortBy === "score") {
        return (b.match?.score || 0) - (a.match?.score || 0);
      } else if (candidateSortBy === "name") {
        return a.candidate.name.localeCompare(b.candidate.name, "zh-CN");
      } else if (candidateSortBy.startsWith("dim:")) {
        const dimId = candidateSortBy.slice(4);
        const aScore = a.match?.dimensionScores?.find(d => d.dimensionId === dimId)?.score || 0;
        const bScore = b.match?.dimensionScores?.find(d => d.dimensionId === dimId)?.score || 0;
        return bScore - aScore;
      }
      return 0;
    });

    return matched;
  };

  const getScoreDistribution = (jobId: string) => {
    const matched = getMatchedCandidates(jobId);
    const distribution = {
      excellent: matched.filter(m => (m.match?.score || 0) >= 80).length,
      good: matched.filter(m => {
        const score = m.match?.score || 0;
        return score >= 60 && score < 80;
      }).length,
      needsImprovement: matched.filter(m => (m.match?.score || 0) < 60).length,
    };
    return distribution;
  };

  function ScoreDistributionIndicator({ distribution }: { distribution: { excellent: number; good: number; needsImprovement: number } }) {
    const total = distribution.excellent + distribution.good + distribution.needsImprovement;
    if (total === 0) return null;

    // 动态圆点大小：基础 8px，每增加 1 人增加 1px，最大 16px
    const getDotSize = (count: number) => {
      const baseSize = 8;
      const maxSize = 16;
      return Math.min(baseSize + count, maxSize);
    };

    return (
      <Popover>
        <PopoverTrigger asChild>
          <div
            className="flex items-center gap-1.5 ml-2 group relative cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="rounded-full bg-green-500 transition-all"
              style={{ width: getDotSize(distribution.excellent), height: getDotSize(distribution.excellent) }}
            />
            <div
              className="rounded-full bg-amber-500 transition-all"
              style={{ width: getDotSize(distribution.good), height: getDotSize(distribution.good) }}
            />
            <div
              className="rounded-full bg-red-500 transition-all"
              style={{ width: getDotSize(distribution.needsImprovement), height: getDotSize(distribution.needsImprovement) }}
            />
            <Info className="w-3 h-3 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
          </div>
        </PopoverTrigger>
        <PopoverContent side="bottom" className="w-auto p-3" align="start">
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span>优秀 (≥80分): <strong>{distribution.excellent}</strong> 人</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>良好 (60-79分): <strong>{distribution.good}</strong> 人</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>待提升 (&lt;60分): <strong>{distribution.needsImprovement}</strong> 人</span>
            </div>
            <div className="pt-1 border-t border-border/50 text-muted-foreground">
              共计 {total} 位候选人
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

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

            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto p-0">
                <DialogHeader className="px-6 pt-6 pb-0">
                  <DialogTitle className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Edit className="w-4 h-4 text-primary" />
                    </div>
                    编辑职位
                  </DialogTitle>
                </DialogHeader>
                <div className="px-6 pb-6">
                  {selectedJob && (
                    <JobEditor
                      job={selectedJob}
                      onSave={async (updatedJob) => {
                        setSaving(true);
                        try {
                          const res = await fetch(`/api/jobs?id=${selectedJob.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(updatedJob),
                          });
                          if (!res.ok) throw new Error("保存失败");
                          toast.success("职位已更新");
                          await loadJobs();
                          setIsEditOpen(false);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "保存失败");
                        } finally {
                          setSaving(false);
                        }
                      }}
                      onCancel={() => setIsEditOpen(false)}
                      saving={saving}
                    />
                  )}
                </div>
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setCandidatesSheetOpen(true)}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      匹配候选人
                      <Badge variant="secondary" className="ml-2">
                        {getMatchedCandidates(selectedJob.id).length}
                      </Badge>
                      <ScoreDistributionIndicator distribution={getScoreDistribution(selectedJob.id)} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="编辑职位"
                      onClick={() => setIsEditOpen(true)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
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
                {selectedJob.scoringRule && selectedJob.scoringRule.dimensions?.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        评分参考
                        <Badge variant="outline" className="text-[10px]">v{selectedJob.scoringRule.version}</Badge>
                      </h3>
                      <div className="flex items-center gap-1">
                        {selectedJob.scoringRuleId && (
                          <a href="/scoring-rules" className="text-xs text-primary hover:underline mr-2">管理 →</a>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsDeleteRuleOpen(true)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <Card className="p-3 bg-primary/5 border-primary/20">
                      <p className="text-sm font-medium mb-2">{selectedJob.scoringRule.name}</p>
                      <div className="space-y-1.5">
                        {selectedJob.scoringRule.dimensions.map((dim, i) => (
                          <div key={dim.id} className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                              <span className="font-medium">{dim.name}</span>
                              {dim.description && <span className="text-muted-foreground">· {dim.description}</span>}
                            </div>
                            <Badge variant="secondary" className="text-[10px]">{dim.weight}%</Badge>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                )}
              </div>
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

      <ConfirmDialog
        open={isDeleteRuleOpen}
        onOpenChange={setIsDeleteRuleOpen}
        title="解除评分参考关联"
        description="确定要解除此岗位与评分参考的关联吗？解除后，候选人匹配将使用默认 AI 评分逻辑。评分参考本身不会被删除。"
        confirmLabel="解除关联"
        onConfirm={handleDeleteScoringRule}
        variant="destructive"
      />

      {/* Candidate Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" size="md" className="p-0">
          {selectedCandidate && (
            <div className="h-full flex flex-col">
              <div className="p-6 border-b shrink-0">
                <SheetHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <SheetTitle className="text-xl">{selectedCandidate.name}</SheetTitle>
                      <div className="text-sm text-muted-foreground mt-1">
                        {selectedCandidate.contact?.email && <div>{selectedCandidate.contact.email}</div>}
                        {selectedCandidate.contact?.phone && <div>{selectedCandidate.contact.phone}</div>}
                      </div>
                    </div>
                    {selectedMatch && (
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${getScoreTextColor(selectedMatch.score)}`}>
                          {selectedMatch.score}分
                        </div>
                        <p className="text-xs text-muted-foreground">匹配度</p>
                      </div>
                    )}
                  </div>
                </SheetHeader>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6">
                  {/* Dimension Scores Section */}
                  {selectedMatch?.dimensionScores && selectedMatch.dimensionScores.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold flex items-center gap-1.5">
                          <div className="w-1 h-4 rounded-full bg-primary" />
                          评分明细
                        </h4>
                        {selectedMatch.scoringSnapshot && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setViewingSnapshot(selectedMatch.scoringSnapshot!);
                              setSnapshotDialogOpen(true);
                            }}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            规则 v{selectedMatch.scoringSnapshot.version}
                            {selectedJob?.scoringRule?.version !== selectedMatch.scoringSnapshot.version && (
                              <Badge variant="outline" className="ml-1.5 text-[9px] h-4 px-1 border-amber-500/50 text-amber-600">旧版</Badge>
                            )}
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2.5">
                        {selectedMatch.dimensionScores.map(ds => (
                          <div key={ds.dimensionId} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium">{ds.dimensionName}</span>
                              <span className={`font-semibold ${
                                ds.score >= 80 ? "text-green-600" : ds.score >= 60 ? "text-amber-600" : "text-red-500"
                              }`}>
                                {ds.score}<span className="text-muted-foreground font-normal">/{ds.maxScore}</span>
                                <span className="text-muted-foreground font-normal ml-1">({ds.weight}%)</span>
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  ds.score >= 80 ? "bg-green-500" : ds.score >= 60 ? "bg-amber-500" : "bg-red-400"
                                }`}
                                style={{ width: `${ds.score}%` }}
                              />
                            </div>
                            {ds.details && (
                              <div className="text-[10px] text-muted-foreground pl-0.5">
                                {ds.details.matched && ds.details.matched.length > 0 && (
                                  <span className="text-green-600">匹配: {ds.details.matched.join(", ")}</span>
                                )}
                                {ds.details.missing && ds.details.missing.length > 0 && (
                                  <span className="text-red-500 ml-2">缺失: {ds.details.missing.join(", ")}</span>
                                )}
                                {ds.details.notes && <span>{ds.details.notes}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <CandidateDetailContent
                    candidate={selectedCandidate}
                    match={selectedMatch ?? undefined}
                    actions={{
                      onScheduleInterview: handleScheduleInterview,
                      onUpdateStatus: handleUpdateCandidateStatus,
                      onViewResume: handleViewResume,
                    }}
                  />
                </div>
              </ScrollArea>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Candidates List Sheet */}
      {selectedJob && (
        <Sheet open={candidatesSheetOpen} onOpenChange={setCandidatesSheetOpen}>
          <SheetContent side="right" size="lg" className="p-0 w-[420px]">
            {(() => {
              const matchedCandidates = getMatchedCandidates(selectedJob.id);
              const jobDimensions = selectedJob.scoringRule?.dimensions || [];

              return (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-border bg-background space-y-3 shrink-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        匹配的候选人
                      </h3>
                      <Badge variant="secondary">{matchedCandidates.length} 位</Badge>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="搜索候选人姓名..."
                        value={candidateSearchQuery}
                        onChange={(e) => setCandidateSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-sm"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Select value={candidateScoreFilter} onValueChange={setCandidateScoreFilter}>
                        <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部分数</SelectItem>
                          <SelectItem value="80">80分以上</SelectItem>
                          <SelectItem value="60">60分以上</SelectItem>
                          <SelectItem value="0">60分以下</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={candidateSortBy} onValueChange={setCandidateSortBy}>
                        <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="score">按总分</SelectItem>
                          <SelectItem value="name">按姓名</SelectItem>
                          {jobDimensions.map(dim => (
                            <SelectItem key={dim.id} value={`dim:${dim.id}`}>按{dim.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Dimension filter */}
                    {jobDimensions.length > 0 && (
                      <div className="flex gap-2 items-center">
                        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <Select value={dimensionFilterId} onValueChange={setDimensionFilterId}>
                          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="按维度筛选" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">不限维度</SelectItem>
                            {jobDimensions.map(dim => (
                              <SelectItem key={dim.id} value={dim.id}>{dim.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {dimensionFilterId !== "none" && (
                          <Select value={dimensionMinScore} onValueChange={setDimensionMinScore}>
                            <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">不限</SelectItem>
                              <SelectItem value="60">≥60分</SelectItem>
                              <SelectItem value="70">≥70分</SelectItem>
                              <SelectItem value="80">≥80分</SelectItem>
                              <SelectItem value="90">≥90分</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-2">
                      {matchedCandidates.length === 0 ? (
                        <div className="text-center py-8">
                          <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                          <p className="text-sm text-muted-foreground">暂无匹配候选人</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {candidateSearchQuery || candidateScoreFilter !== "all" || dimensionFilterId !== "none"
                              ? "尝试调整筛选条件"
                              : "请先在候选人页面进行匹配"}
                          </p>
                        </div>
                      ) : (
                        matchedCandidates.map(({ candidate, match }) => (
                          <Card
                            key={candidate.id}
                            className={`
                              p-3 cursor-pointer transition-all duration-200 border-l-4
                              hover:shadow-md hover:border-opacity-80
                              ${getScoreBorderColor(match!.score)}
                              ${getScoreBgColor(match!.score)}
                            `}
                            onClick={() => openCandidateSheet(candidate, match!)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center
                                font-semibold text-sm shrink-0
                                ${match!.score >= 80 ? "bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-100" :
                                  match!.score >= 60 ? "bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-100" :
                                  "bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-100"}
                              `}>
                                {candidate.name.charAt(0)}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-sm">{candidate.name}</p>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] h-5 px-1.5 border-0 shrink-0 ${getScoreTextColor(match!.score)} ${getScoreBgColor(match!.score)}`}
                                  >
                                    {match!.score}分
                                  </Badge>
                                </div>

                                {/* Dimension score mini bars */}
                                {match!.dimensionScores && match!.dimensionScores.length > 0 && (
                                  <div className="space-y-1 mt-1.5">
                                    {match!.dimensionScores.slice(0, 3).map(ds => (
                                      <div key={ds.dimensionId} className="flex items-center gap-1.5">
                                        <span className="text-[9px] text-muted-foreground w-12 truncate shrink-0">{ds.dimensionName}</span>
                                        <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                                          <div
                                            className={`h-full rounded-full transition-all ${
                                              ds.score >= 80 ? "bg-green-500" : ds.score >= 60 ? "bg-amber-500" : "bg-red-400"
                                            }`}
                                            style={{ width: `${ds.score}%` }}
                                          />
                                        </div>
                                        <span className="text-[9px] text-muted-foreground w-6 text-right shrink-0">{ds.score}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {!match!.dimensionScores && match!.reason && (
                                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1">{match!.reason}</p>
                                )}
                              </div>

                              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            </div>
                          </Card>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })()}
          </SheetContent>
        </Sheet>
      )}

      {/* Scoring Rule Snapshot Dialog */}
      <Dialog open={snapshotDialogOpen} onOpenChange={setSnapshotDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              评分参考快照
              {viewingSnapshot && (
                <Badge variant="secondary" className="text-[10px]">v{viewingSnapshot.version}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {viewingSnapshot && (
            <div className="space-y-4">
              <div className="text-sm">
                <span className="text-muted-foreground">规则名称：</span>
                <span className="font-medium">{viewingSnapshot.ruleName}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                快照时间：{new Date(viewingSnapshot.snapshotAt).toLocaleString("zh-CN")}
              </div>
              <div className="space-y-2">
                {viewingSnapshot.dimensions.map(dim => (
                  <div key={dim.id} className="rounded-lg border border-border/50 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{dim.name}</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                          {dim.type}
                        </Badge>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{dim.weight}%</Badge>
                    </div>
                    {dim.description && (
                      <p className="text-xs text-muted-foreground">{dim.description}</p>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      评估方法: {dim.evaluator.method}
                      {dim.evaluator.keywords?.length ? ` · 关键词: ${dim.evaluator.keywords.join(", ")}` : ""}
                      {dim.evaluator.minYears ? ` · 最低${dim.evaluator.minYears}年` : ""}
                      {dim.evaluator.aiPrompt ? ` · ${dim.evaluator.aiPrompt.slice(0, 50)}...` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SmartJobCreator({ onCreated }: { onCreated: () => void }) {
  const [freeText, setFreeText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<Job | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showRuleSelector, setShowRuleSelector] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string>("none");
  const [allRules, setAllRules] = useState<ScoringRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);

  useEffect(() => {
    const fetchRules = async () => {
      setLoadingRules(true);
      try {
        const res = await fetch("/api/scoring-rules");
        const data = await res.json();
        setAllRules(data.rules || []);
      } catch { /* ignore */ }
      finally { setLoadingRules(false); }
    };
    fetchRules();
  }, []);

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
          scoringRuleId: selectedRuleId !== "none" ? selectedRuleId : undefined,
        }),
      });
      if (!res.ok) throw new Error("保存失败");
      toast.success("职位已发布");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    }
  };

  const selectedRule = allRules.find(r => r.id === selectedRuleId);

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

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRuleSelector(!showRuleSelector)}
            className="w-full"
          >
            <Target className="w-4 h-4 mr-1" />
            {showRuleSelector ? "收起评分参考" : "关联评分参考"}
            {selectedRuleId !== "none" && <Badge variant="secondary" className="ml-2">已关联</Badge>}
          </Button>

          {showRuleSelector && (
            <div className="border-t pt-3 space-y-3">
              <Select value={selectedRuleId} onValueChange={setSelectedRuleId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="请选择评分参考" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不关联评分参考</SelectItem>
                  {loadingRules ? (
                    <SelectItem value="_loading" disabled>加载中...</SelectItem>
                  ) : (
                    allRules.map(rule => (
                      <SelectItem key={rule.id} value={rule.id}>
                        {rule.name} (v{rule.version} · {rule.dimensions?.length || 0}维度)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedRule && selectedRule.dimensions?.length > 0 && (
                <div className="text-xs space-y-1 pl-1">
                  {selectedRule.dimensions.map((dim, i) => (
                    <div key={dim.id} className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-medium text-foreground">{i + 1}. {dim.name}</span>
                      <span>{dim.weight}%</span>
                    </div>
                  ))}
                </div>
              )}
              <a href="/scoring-rules" target="_blank" className="text-xs text-primary hover:underline">
                前往规则管理页 →
              </a>
            </div>
          )}

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

function JobEditor({
  job,
  onSave,
  onCancel,
  saving,
}: {
  job: Job;
  onSave: (job: Partial<Job>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [editData, setEditData] = useState<Job>(() => ({
    ...job,
    description: job.description ? { ...job.description } : {
      overview: "",
      responsibilities: [],
      requirements: [],
      benefits: [],
    },
    skills: job.skills ? [...job.skills] : [],
    createdAt: new Date(job.createdAt),
    updatedAt: new Date(job.updatedAt),
  }));
  const [activeTab, setActiveTab] = useState<"info" | "rules">("info");
  const [allRules, setAllRules] = useState<ScoringRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string>(job.scoringRuleId || "none");
  const [previewRule, setPreviewRule] = useState<ScoringRule | null>(job.scoringRule || null);
  const [loadingRules, setLoadingRules] = useState(false);

  useEffect(() => {
    const fetchRules = async () => {
      setLoadingRules(true);
      try {
        const res = await fetch("/api/scoring-rules");
        const data = await res.json();
        setAllRules(data.rules || []);
      } catch { /* ignore */ }
      finally { setLoadingRules(false); }
    };
    fetchRules();
  }, []);

  const handleRuleSelect = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    if (ruleId === "none") {
      setPreviewRule(null);
      setEditData({ ...editData, scoringRuleId: undefined });
    } else {
      const rule = allRules.find(r => r.id === ruleId);
      setPreviewRule(rule || null);
      setEditData({ ...editData, scoringRuleId: ruleId });
    }
  };

  const handleSave = async () => {
    await onSave(editData);
  };

  const methodLabels: Record<string, string> = {
    keyword: "关键词", duration: "年限", ai: "AI", boolean: "布尔", range: "范围",
  };
  const typeLabels: Record<string, string> = {
    skills: "技能", experience: "经验", education: "教育", projects: "项目", custom: "自定义",
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "info" | "rules")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="info">职位信息</TabsTrigger>
          <TabsTrigger value="rules">
            评分参考
            {selectedRuleId !== "none" && (
              <Badge variant="secondary" className="ml-2">已关联</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>职位名称</Label>
              <Input value={editData.title} onChange={(e) => setEditData({ ...editData, title: e.target.value })} />
            </div>
            <div>
              <Label>部门</Label>
              <Input value={editData.department} onChange={(e) => setEditData({ ...editData, department: e.target.value })} />
            </div>
            <div>
              <Label>级别</Label>
              <Select value={editData.level} onValueChange={(v) => setEditData({ ...editData, level: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">初级</SelectItem>
                  <SelectItem value="mid">中级</SelectItem>
                  <SelectItem value="senior">高级</SelectItem>
                  <SelectItem value="expert">专家</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>状态</Label>
              <Select value={editData.status} onValueChange={(v) => setEditData({ ...editData, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">招聘中</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="paused">暂停</SelectItem>
                  <SelectItem value="closed">已关闭</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>技能 (逗号分隔)</Label>
            <Input
              value={editData.skills?.join(", ") || ""}
              onChange={(e) => setEditData({ ...editData, skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
          </div>

          <div>
            <Label>职位概述</Label>
            <Textarea value={editData.description?.overview || ""} onChange={(e) => setEditData({ ...editData, description: { ...editData.description, overview: e.target.value } })} rows={3} />
          </div>

          <div>
            <Label>岗位职责 (每行一项)</Label>
            <Textarea value={editData.description?.responsibilities?.join("\n") || ""} onChange={(e) => setEditData({ ...editData, description: { ...editData.description, responsibilities: e.target.value.split("\n").filter(Boolean) } })} rows={4} />
          </div>

          <div>
            <Label>任职要求 (每行一项)</Label>
            <Textarea value={editData.description?.requirements?.join("\n") || ""} onChange={(e) => setEditData({ ...editData, description: { ...editData.description, requirements: e.target.value.split("\n").filter(Boolean) } })} rows={4} />
          </div>

          <div>
            <Label>福利待遇 (每行一项)</Label>
            <Textarea value={editData.description?.benefits?.join("\n") || ""} onChange={(e) => setEditData({ ...editData, description: { ...editData.description, benefits: e.target.value.split("\n").filter(Boolean) } })} rows={3} />
          </div>
        </TabsContent>

        <TabsContent value="rules" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">选择评分参考</Label>
            <Select value={selectedRuleId} onValueChange={handleRuleSelect}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="请选择评分参考" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不关联评分参考</SelectItem>
                {loadingRules ? (
                  <SelectItem value="_loading" disabled>加载中...</SelectItem>
                ) : (
                  allRules.map(rule => (
                    <SelectItem key={rule.id} value={rule.id}>
                      <div className="flex items-center gap-2">
                        <span>{rule.name}</span>
                        <span className="text-muted-foreground text-[10px]">
                          v{rule.version} · {rule.dimensions?.length || 0}维度
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <a href="/scoring-rules" target="_blank" className="text-xs text-primary hover:underline">
                前往规则管理页 →
              </a>
            </div>
          </div>

          {/* Preview of selected rule */}
          {previewRule && previewRule.dimensions?.length > 0 && (
            <Card className="p-4 space-y-3 border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{previewRule.name}</p>
                  {previewRule.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{previewRule.description}</p>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px]">v{previewRule.version}</Badge>
              </div>
              <div className="space-y-1.5">
                {previewRule.dimensions.map((dim, i) => (
                  <div key={dim.id} className="flex items-center gap-2 text-xs">
                    <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                    <span className="font-medium flex-1">{dim.name}</span>
                    <Badge variant="secondary" className="text-[9px] h-4 px-1">{typeLabels[dim.type] || dim.type}</Badge>
                    <Badge variant="outline" className="text-[9px] h-4 px-1">{methodLabels[dim.evaluator?.method] || "AI"}</Badge>
                    <span className="text-muted-foreground w-10 text-right">{dim.weight}%</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {selectedRuleId === "none" && (
            <div className="text-center py-8 rounded-xl border border-dashed border-border/50 bg-muted/20">
              <Target className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">未关联评分参考</p>
              <p className="text-xs text-muted-foreground/60 mt-1">候选人匹配将使用默认 AI 评分</p>
              <a href="/scoring-rules" target="_blank" className="text-xs text-primary hover:underline mt-2 inline-block">
                前往评分参考页创建 →
              </a>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={saving}>取消</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          保存更改
        </Button>
      </div>
    </div>
  );
}
