"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, Upload, Search, Loader2, FileText, Sparkles, Trash2, Edit, X, Plus, ChevronsUpDown, AlertTriangle,
  ArrowRight, CheckCircle2, Clock3, Filter, Tags, Zap, BriefcaseBusiness,
} from "lucide-react";
import { toast } from "sonner";
import type { Candidate, Interview, Job } from "@/lib/types";
import { deriveCandidateWorkbenchData, sortCandidatesForWorkbench } from "@/lib/workbench-utils";

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  pending: { label: "待筛选", dot: "bg-muted-foreground", bg: "bg-muted", text: "text-muted-foreground" },
  screening: { label: "筛选中", dot: "bg-blue-500", bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  interview: { label: "面试中", dot: "bg-purple-500", bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400" },
  offered: { label: "已发Offer", dot: "bg-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  hired: { label: "已录用", dot: "bg-green-500", bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400" },
  rejected: { label: "已淘汰", dot: "bg-red-500", bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400" },
};

type CandidateExperienceForm = {
  company: string;
  position: string;
  duration: string;
  description: string;
};

type CandidateEducationForm = {
  school: string;
  degree: string;
  major: string;
  graduation?: string;
};

type CandidateEditForm = {
  name: string;
  email: string;
  phone: string;
  summary: string;
  skills: string;
  experience: CandidateExperienceForm[];
  education: CandidateEducationForm[];
};

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [analyzing, setAnalyzing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchingAll, setMatchingAll] = useState(false);
  const [batchMatching, setBatchMatching] = useState(false);
  const [processingCandidateIds, setProcessingCandidateIds] = useState<Set<string>>(new Set());
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [batchFailedTasks, setBatchFailedTasks] = useState<Array<{ candidateId: string; jobId: string; error?: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [showLegacyBatchActions, setShowLegacyBatchActions] = useState(false);
  const [showJobSelector, setShowJobSelector] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<"single" | "batch">("single");
  const [deleting, setDeleting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<CandidateEditForm | null>(null);
  const [newManualTag, setNewManualTag] = useState("");

  const loadData = async () => {
    try {
      const [candRes, jobsRes, interviewsRes] = await Promise.all([
        fetch("/api/candidates").then((r) => r.json()),
        fetch("/api/jobs").then((r) => r.json()),
        fetch("/api/interviews").then((r) => r.json()),
      ]);
      const nextCandidates = candRes.candidates || [];
      setCandidates(nextCandidates);
      setJobs(jobsRes.jobs || []);
      setInterviews(interviewsRes.interviews || []);
      setSelectedCandidate((current) => {
        if (!current) return nextCandidates[0] || null;
        return nextCandidates.find((candidate: Candidate) => candidate.id === current.id) || nextCandidates[0] || null;
      });
    } catch { toast.error("加载数据失败"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleAnalyze = async (id: string) => {
    setAnalyzing(true);
    setProcessingCandidateIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/candidates/${id}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("AI分析完成");
      setSelectedCandidate(data);
      loadData();
    } catch (err) { toast.error(err instanceof Error ? err.message : "分析失败"); }
    finally {
      setAnalyzing(false);
      setProcessingCandidateIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleMatch = async (candidateId: string, jobId: string) => {
    setMatching(true);
    setProcessingCandidateIds((prev) => new Set(prev).add(candidateId));
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
    finally {
      setMatching(false);
      setProcessingCandidateIds((prev) => {
        const next = new Set(prev);
        next.delete(candidateId);
        return next;
      });
    }
  };

  const handleMatchAll = async (candidateId: string) => {
    setMatchingAll(true);
    setProcessingCandidateIds((prev) => new Set(prev).add(candidateId));
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
    finally {
      setMatchingAll(false);
      setProcessingCandidateIds((prev) => {
        const next = new Set(prev);
        next.delete(candidateId);
        return next;
      });
    }
  };

  const handleBatchMatchAll = async () => {
    const targets = candidates.filter(c => ["pending", "screening", "interview"].includes(c.status));
    if (targets.length === 0) { toast.info("没有需要匹配的候选人"); return; }
    setBatchMatching(true);
    setBatchProgress({ done: 0, total: targets.length });
    setProcessingCandidateIds(new Set(targets.map((candidate) => candidate.id)));
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
    setProcessingCandidateIds(new Set());
    toast.success(`批量匹配完成：${succeeded}/${targets.length} 成功`);
    loadData();
  };

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const handleSelectAllJobs = () => {
    const activeJobIds = jobs.filter((j) => j.status === "active").map((j) => j.id);
    setSelectedJobIds(new Set(activeJobIds));
  };

  const handleClearJobs = () => {
    setSelectedJobIds(new Set());
  };

  const handlePreciseBatchMatch = async (retryFailedOnly = false) => {
    const activeJobIds = jobs.filter((j) => j.status === "active").map((j) => j.id);
    const chosenJobIds = Array.from(selectedJobIds).filter((id) => activeJobIds.includes(id));
    const chosenCandidateIds = retryFailedOnly
      ? Array.from(new Set(batchFailedTasks.map((t) => t.candidateId)))
      : Array.from(selectedIds);

    if (chosenCandidateIds.length === 0) {
      toast.info(retryFailedOnly ? "暂无失败任务可重试" : "请先选择候选人");
      return;
    }
    if (!retryFailedOnly && chosenJobIds.length === 0) {
      toast.info("请先选择职位");
      return;
    }

    const estimated = retryFailedOnly
      ? batchFailedTasks.length
      : chosenCandidateIds.length * chosenJobIds.length;

    const proceed = confirm(`将执行 ${estimated} 个匹配任务，是否继续？`);
    if (!proceed) return;

    setBatchMatching(true);
    setBatchProgress({ done: 0, total: estimated });
    setBatchFailedTasks([]);
    setProcessingCandidateIds(new Set(chosenCandidateIds));

    const allResults: Array<{ candidateId: string; jobId: string; ok: boolean; error?: string }> = [];
    let processed = 0;

    if (retryFailedOnly) {
      const grouped = new Map<string, string[]>();
      for (const item of batchFailedTasks) {
        const existing = grouped.get(item.candidateId) || [];
        existing.push(item.jobId);
        grouped.set(item.candidateId, existing);
      }

      for (const [candidateId, jobIds] of grouped.entries()) {
        try {
          const res = await fetch("/api/candidates/match-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ candidateIds: [candidateId], jobIds }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "匹配失败");
          if (Array.isArray(data.results)) allResults.push(...data.results);
        } catch {
          for (const jobId of jobIds) {
            allResults.push({ candidateId, jobId, ok: false, error: "请求失败" });
          }
        }
        processed += jobIds.length;
        setBatchProgress({ done: processed, total: estimated });
      }
    } else {
      for (const candidateId of chosenCandidateIds) {
        try {
          const res = await fetch("/api/candidates/match-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ candidateIds: [candidateId], jobIds: chosenJobIds }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "匹配失败");
          if (Array.isArray(data.results)) allResults.push(...data.results);
        } catch {
          for (const jobId of chosenJobIds) {
            allResults.push({ candidateId, jobId, ok: false, error: "请求失败" });
          }
        }
        processed += chosenJobIds.length;
        setBatchProgress({ done: processed, total: estimated });
      }
    }

    const failedTasks = allResults.filter((r) => !r.ok).map((r) => ({
      candidateId: r.candidateId,
      jobId: r.jobId,
      error: r.error,
    }));
    const success = allResults.length - failedTasks.length;
    setBatchFailedTasks(failedTasks);
    setBatchMatching(false);
    setProcessingCandidateIds(new Set());

    if (failedTasks.length > 0) {
      toast.warning(`匹配完成：${success}/${allResults.length} 成功，失败 ${failedTasks.length}`);
    } else {
      toast.success(`匹配完成：${success}/${allResults.length} 成功`);
    }
    loadData();
  };

  const getTopScore = (c: Candidate): number => {
    if (!c.matchedJobs?.length) return -1;
    return Math.max(...c.matchedJobs.map(m => m.score));
  };

  const matchedJobTitles = Array.from(new Set(
    candidates.flatMap(c => c.matchedJobs?.map(m => m.jobTitle).filter(Boolean) || [])
  )) as string[];
  const activeJobs = jobs.filter((j) => j.status === "active");

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
      setSelectedIds(new Set(filtered.map((item) => item.candidate.id)));
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

  const handleManualTagAdd = async () => {
    if (!selectedCandidate || !newManualTag.trim()) return;
    const nextTag = newManualTag.trim();
    const manualTags = Array.from(new Set([...(selectedCandidate.manualTags || []), nextTag]));
    try {
      const res = await fetch("/api/candidates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedCandidate.id, manualTags }),
      });
      if (!res.ok) throw new Error("标签保存失败");
      toast.success("已添加标签");
      setNewManualTag("");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "标签保存失败");
    }
  };

  const handleManualTagRemove = async (tag: string) => {
    if (!selectedCandidate) return;
    const manualTags = (selectedCandidate.manualTags || []).filter((item) => item !== tag);
    try {
      const res = await fetch("/api/candidates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedCandidate.id, manualTags }),
      });
      if (!res.ok) throw new Error("标签删除失败");
      toast.success("已移除标签");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "标签删除失败");
    }
  };

  const resetWorkbenchFilters = () => {
    setStatusFilter("all");
    setScoreFilter("all");
    setJobFilter("all");
    setTagFilter("all");
    setSearchQuery("");
  };

  const applyWorkbenchQuickFilter = (type: "needs_review" | "follow_up" | "not_started") => {
    setStatusFilter("all");
    setScoreFilter("all");
    setJobFilter("all");
    setSearchQuery("");

    if (type === "needs_review") {
      setTagFilter("待复核");
      return;
    }
    if (type === "follow_up") {
      setTagFilter("待安排面试");
      return;
    }
    setTagFilter("all");
    setScoreFilter("none");
  };

  const handleEdit = () => {
    if (!selectedCandidate) return;
    setEditForm({
      name: selectedCandidate.name,
      email: selectedCandidate.contact?.email || "",
      phone: selectedCandidate.contact?.phone || "",
      summary: selectedCandidate.resume?.parsedData?.summary || "",
      skills: selectedCandidate.resume?.parsedData?.skills?.join(", ") || "",
      experience: selectedCandidate.resume?.parsedData?.experience || [],
      education: selectedCandidate.resume?.parsedData?.education || [],
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedCandidate || !editForm) return;
    setEditing(true);
    try {
      const parsedData = {
        summary: editForm.summary,
        skills: editForm.skills.split(",").map((s: string) => s.trim()).filter((s: string) => s),
        experience: editForm.experience,
        education: editForm.education,
      };

      const res = await fetch("/api/candidates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedCandidate.id,
          name: editForm.name,
          contact: {
            email: editForm.email,
            phone: editForm.phone || undefined,
          },
          resume: {
            ...selectedCandidate.resume,
            parsedData,
          },
        }),
      });

      if (!res.ok) throw new Error("保存失败");

      const data = await res.json();
      toast.success("已保存");
      setSelectedCandidate(data);
      loadData();
      setIsEditDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setEditing(false);
    }
  };

  const addExperience = () => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      experience: [
        ...editForm.experience,
        { company: "", position: "", duration: "", description: "" },
      ],
    });
  };

  const removeExperience = (index: number) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      experience: editForm.experience.filter((_, i) => i !== index),
    });
  };

  const updateExperience = (index: number, field: string, value: string) => {
    if (!editForm) return;
    const updated = [...editForm.experience];
    updated[index] = { ...updated[index], [field]: value };
    setEditForm({ ...editForm, experience: updated });
  };

  const addEducation = () => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      education: [
        ...editForm.education,
        { school: "", degree: "", major: "", graduation: "" },
      ],
    });
  };

  const removeEducation = (index: number) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      education: editForm.education.filter((_, i) => i !== index),
    });
  };

  const updateEducation = (index: number, field: string, value: string) => {
    if (!editForm) return;
    const updated = [...editForm.education];
    updated[index] = { ...updated[index], [field]: value };
    setEditForm({ ...editForm, education: updated });
  };

  const candidateWorkbench = useMemo(() => {
    const activeOrPausedJobs = jobs.filter((job) => ["active", "paused"].includes(job.status));
    const decorated = candidates.map((candidate) => {
      const withProcessingState = processingCandidateIds.has(candidate.id)
        ? {
            ...candidate,
            matchProgress: {
              status: "matching" as const,
              matchedJobCount: candidate.matchedJobs?.length ?? 0,
              totalJobCount: activeOrPausedJobs.filter((job) => job.status === "active").length,
              lastMatchedAt: candidate.matchProgress?.lastMatchedAt,
              needsReview: false,
            },
          }
        : candidate;
      return deriveCandidateWorkbenchData(withProcessingState, activeOrPausedJobs, interviews);
    });

    return sortCandidatesForWorkbench(decorated);
  }, [candidates, jobs, interviews, processingCandidateIds]);

  const availableTags = Array.from(new Set(candidateWorkbench.flatMap((item) => item.allTags))).sort((left, right) =>
    left.localeCompare(right, "zh-CN")
  );

  const filtered = candidateWorkbench.filter((item) => {
    const c = item.candidate;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (tagFilter !== "all" && !item.allTags.includes(tagFilter)) return false;
    if (jobFilter !== "all") {
      if (!c.matchedJobs?.some(m => m.jobTitle === jobFilter)) return false;
    }
    if (scoreFilter !== "all") {
      const top = getTopScore(c);
      if (scoreFilter === "80+" && top < 80) return false;
      if (scoreFilter === "60-80" && (top < 60 || top >= 80)) return false;
      if (scoreFilter === "60-" && (top >= 60 || top < 0)) return false;
      if (scoreFilter === "none" && top >= 0) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.contact?.email ?? "").toLowerCase().includes(q) ||
        c.resume?.parsedData?.skills?.some((s) => s.toLowerCase().includes(q)) ||
        item.allTags.some((tag) => tag.toLowerCase().includes(q));
    }
    return true;
  });

  const selectedCandidateData = selectedCandidate
    ? candidateWorkbench.find((item) => item.candidate.id === selectedCandidate.id)
    : null;
  const suggestedCandidates = filtered.slice(0, 3);
  const urgentCount = candidateWorkbench.filter((item) => item.progress.status === "needs_review").length;
  const followUpCount = candidateWorkbench.filter((item) => item.systemTags.includes("待安排面试")).length;
  const notStartedCount = candidateWorkbench.filter((item) => item.progress.status === "not_started").length;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.06),transparent_24%)] xl:grid xl:grid-cols-[320px_minmax(360px,1.05fr)_minmax(440px,1fr)] xl:gap-0">
      <div className="border-b border-border/40 bg-background/85 backdrop-blur xl:border-b-0 xl:border-r">
        <div className="space-y-4 p-4 page-drag-header">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold"><Users className="h-5 w-5" />候选人工作台</h1>
              <p className="mt-1 text-xs text-muted-foreground">先判断优先级，再进入中间名单执行批量操作，最后在右侧做单人决策。</p>
            </div>
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Upload className="mr-1 h-4 w-4" />添加简历</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>添加简历</DialogTitle></DialogHeader>
                <ResumeDropZone onUploaded={handleUploaded} />
              </DialogContent>
            </Dialog>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="搜索候选人、技能、标签..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部评分</SelectItem>
                <SelectItem value="80+">80分以上</SelectItem>
                <SelectItem value="60-80">60-80分</SelectItem>
                <SelectItem value="60-">60分以下</SelectItem>
                <SelectItem value="none">未匹配</SelectItem>
              </SelectContent>
            </Select>
            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger><SelectValue placeholder="按职位筛选" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部职位</SelectItem>
                {matchedJobTitles.map((title) => <SelectItem key={title} value={title}>{title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger><SelectValue placeholder="按标签筛选" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部标签</SelectItem>
                {availableTags.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card className="border-border/40 bg-card/90 p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">智能建议</p>
                <p className="text-[11px] text-muted-foreground">点击汇总卡可直接筛出对应候选人名单。</p>
              </div>
              <Badge variant="secondary" className="text-[10px]">共 {candidateWorkbench.length} 人</Badge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 text-left transition-all hover:-translate-y-0.5 hover:bg-amber-500/10" onClick={() => applyWorkbenchQuickFilter("needs_review")}>
                <p className="text-lg font-semibold text-amber-600">{urgentCount}</p>
                <p className="text-[11px] text-muted-foreground">待复核</p>
              </button>
              <button type="button" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-left transition-all hover:-translate-y-0.5 hover:bg-emerald-500/10" onClick={() => applyWorkbenchQuickFilter("follow_up")}>
                <p className="text-lg font-semibold text-emerald-600">{followUpCount}</p>
                <p className="text-[11px] text-muted-foreground">待安排面试</p>
              </button>
              <button type="button" className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-3 text-left transition-all hover:-translate-y-0.5 hover:bg-sky-500/10" onClick={() => applyWorkbenchQuickFilter("not_started")}>
                <p className="text-lg font-semibold text-sky-600">{notStartedCount}</p>
                <p className="text-[11px] text-muted-foreground">未匹配</p>
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {suggestedCandidates.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">当前筛选下暂无建议对象。</p>
              ) : suggestedCandidates.map((item) => (
                <button
                  key={item.candidate.id}
                  type="button"
                  onClick={() => setSelectedCandidate(item.candidate)}
                  className="flex w-full items-center justify-between rounded-2xl border border-border/50 bg-muted/20 px-3 py-2.5 text-left transition-all hover:border-primary/30 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.candidate.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{item.recommendedAction.label} · {item.recommendedAction.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="min-h-0 border-b border-border/40 bg-background/70 xl:border-b-0 xl:border-r">
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between border-b border-border bg-primary/10 px-4 py-2">
            <span className="text-sm font-medium">已选 {selectedIds.size} 项</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={handleSelectAll}>
                {selectedIds.size === filtered.length && filtered.length > 0 ? "取消全选" : "全选"}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete()} disabled={deleting}>
                {deleting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}批量删除
              </Button>
            </div>
          </div>
        )}
        <div className="border-b border-border/40 bg-background/90 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">候选人列表</h2>
              <p className="text-[11px] text-muted-foreground">这里是主操作区。先看名单，再做批量匹配或进入单人详情。</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{filtered.length}</Badge>
              {(statusFilter !== "all" || scoreFilter !== "all" || jobFilter !== "all" || tagFilter !== "all" || searchQuery) && (
                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={resetWorkbenchFilters}>
                  清空筛选
                </Button>
              )}
            </div>
          </div>
          <Card className="mt-3 border-border/40 bg-card/95 p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold">批量匹配操作台</p>
                <p className="text-[11px] text-muted-foreground">先在当前列表勾选候选人，再决定要匹配的职位范围。</p>
              </div>
              <Badge variant="outline" className="text-[10px]">候选人 {selectedIds.size} · 职位 {selectedJobIds.size}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleSelectAll}>
                {selectedIds.size === filtered.length && filtered.length > 0 ? "取消全选当前列表" : "全选当前列表"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setShowJobSelector((value) => !value)}>
                <Filter className="mr-1 h-3 w-3" />{showJobSelector ? "收起职位选择" : "展开职位选择"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleSelectAllJobs}>
                全选职位
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={handleClearJobs}>
                清空职位
              </Button>
            </div>
            {showJobSelector && (
              <div className="mt-2 max-h-28 overflow-y-auto rounded-lg border border-border/40 bg-muted/20 p-2">
                {activeJobs.length === 0 && <p className="text-[11px] text-muted-foreground">暂无在招职位</p>}
                <div className="space-y-1">
                  {activeJobs.map((job) => (
                    <label key={job.id} className="flex items-center gap-2 text-[11px]">
                      <input
                        type="checkbox"
                        checked={selectedJobIds.has(job.id)}
                        onChange={() => toggleJobSelection(job.id)}
                        className="h-3.5 w-3.5 rounded border-border"
                      />
                      <span className="truncate">{job.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" className="flex-1 min-w-[160px]" onClick={() => handlePreciseBatchMatch(false)} disabled={batchMatching}>
                {batchMatching ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                {batchMatching ? `执行中 ${batchProgress.done}/${batchProgress.total}` : "执行精准匹配"}
              </Button>
              <Button size="sm" variant="outline" disabled={batchMatching || batchFailedTasks.length === 0} onClick={() => handlePreciseBatchMatch(true)}>
                重试失败({batchFailedTasks.length})
              </Button>
              <Button type="button" size="sm" variant="ghost" className="text-[11px]" onClick={() => setShowLegacyBatchActions((value) => !value)}>
                <ChevronsUpDown className="mr-1 h-3 w-3" />高级批量操作
              </Button>
            </div>
            {showLegacyBatchActions && (
              <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><AlertTriangle className="h-3 w-3 text-amber-500" />对当前全部候选人匹配全部在招职位，适合集中跑一轮粗筛。</p>
                <Button size="sm" variant="outline" className="mt-2 w-full border-amber-500/40 text-amber-700 hover:bg-amber-500/10" onClick={handleBatchMatchAll} disabled={batchMatching}>
                  <Sparkles className="mr-1 h-3 w-3" />一键匹配所有候选人
                </Button>
              </div>
            )}
          </Card>
        </div>
        <ScrollArea className="h-[36vh] xl:h-full">
          <div className="space-y-2 p-3">
            {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> :
             filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-background/70 px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Filter className="h-5 w-5 text-primary/60" />
                </div>
                <p className="text-sm font-medium">当前筛选下没有候选人</p>
                <p className="mt-1 text-xs text-muted-foreground">可以清空筛选查看全部名单，或添加新的简历。</p>
              </div>
             ) :
             filtered.map((item) => {
              const c = item.candidate;
              const topScore = getTopScore(c);
              const progressPercent = item.progress.totalJobCount > 0
                ? Math.round((item.progress.matchedJobCount / item.progress.totalJobCount) * 100)
                : 0;
              return (
                <Card
                  key={c.id}
                  className={`cursor-pointer border p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                    selectedCandidate?.id === c.id ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/15" : "border-border/50 bg-background/80 hover:border-primary/30"
                  }`}
                  onClick={(e) => handleCardClick(c, e)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => handleSelectOne(c.id)}
                      className="mt-1 h-4 w-4 rounded border-border"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{c.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{c.contact?.email || c.source || "暂无联系方式"}</p>
                        </div>
                        <div className={`flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 ${STATUS_CONFIG[c.status]?.bg || "bg-muted"} ${STATUS_CONFIG[c.status]?.text || "text-muted-foreground"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[c.status]?.dot || "bg-muted-foreground"}`} />
                          <span className="text-[10px] font-semibold">{STATUS_CONFIG[c.status]?.label || c.status}</span>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-border/40 bg-muted/20 p-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <Clock3 className="h-3.5 w-3.5 text-primary/70" />
                            <span className="font-medium">
                              {{
                                not_started: "未开始",
                                matching: "匹配中",
                                completed: "已完成",
                                needs_review: "需复核",
                              }[item.progress.status]}
                            </span>
                          </div>
                          <span className="text-muted-foreground">{item.progress.matchedJobCount}/{item.progress.totalJobCount || 0}</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${item.progress.status === "needs_review" ? "bg-amber-500" : item.progress.status === "matching" ? "bg-sky-500" : "bg-emerald-500"}`} style={{ width: `${item.progress.status === "needs_review" ? Math.max(progressPercent, 20) : progressPercent}%` }} />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] text-muted-foreground">{item.bestMatch?.jobTitle || "暂无最佳匹配职位"}</span>
                          <Badge variant="outline" className="border-0 bg-background/70 text-[10px]">{topScore >= 0 ? `${topScore} 分` : "待匹配"}</Badge>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.allTags.slice(0, 4).map((tag) => (
                          <Badge key={tag} variant={item.systemTags.includes(tag) ? "secondary" : "outline"} className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <div className="min-h-0 bg-background/90 backdrop-blur">
        {selectedCandidateData ? (
          <ScrollArea className="h-[38vh] xl:h-full">
            <div className="space-y-6 p-4 xl:p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold">{selectedCandidateData.candidate.name}</h2>
                    <Badge variant="outline" className="border-0 bg-primary/10 text-primary">
                      {selectedCandidateData.recommendedAction.label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {selectedCandidateData.candidate.contact?.email && <span>{selectedCandidateData.candidate.contact.email}</span>}
                    {selectedCandidateData.candidate.contact?.phone && <span>{selectedCandidateData.candidate.contact.phone}</span>}
                    {selectedCandidateData.bestMatch?.jobTitle && <span>最佳匹配：{selectedCandidateData.bestMatch.jobTitle}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={selectedCandidateData.candidate.status} onValueChange={(value) => handleStatusChange(selectedCandidateData.candidate.id, value)}>
                    <SelectTrigger className={`h-8 w-32 rounded-full border-0 ${STATUS_CONFIG[selectedCandidateData.candidate.status]?.bg || "bg-muted"} ${STATUS_CONFIG[selectedCandidateData.candidate.status]?.text || "text-muted-foreground"}`}>
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${STATUS_CONFIG[selectedCandidateData.candidate.status]?.dot || "bg-muted-foreground"}`} />
                        <span className="text-xs font-semibold">{STATUS_CONFIG[selectedCandidateData.candidate.status]?.label || selectedCandidateData.candidate.status}</span>
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
                  <Button variant="outline" size="icon" onClick={handleEdit}><Edit className="h-4 w-4" /></Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(selectedCandidateData.candidate.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <Card className="border-border/40 bg-card/95 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">匹配进度时间线</p>
                      <p className="text-xs text-muted-foreground">从简历解析到推荐动作，当前节点一眼可见。</p>
                    </div>
                    <Badge variant="secondary">
                      {{
                        not_started: "未开始",
                        matching: "匹配中",
                        completed: "已完成",
                        needs_review: "需复核",
                      }[selectedCandidateData.progress.status]}
                    </Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: "简历已入库", done: true, desc: selectedCandidateData.candidate.resume?.filename || "已上传简历" },
                      { label: "职位匹配", done: selectedCandidateData.progress.matchedJobCount > 0, desc: `${selectedCandidateData.progress.matchedJobCount}/${selectedCandidateData.progress.totalJobCount || 0} 已完成` },
                      { label: "结果复核", done: !selectedCandidateData.progress.needsReview, desc: selectedCandidateData.progress.needsReview ? "仍需人工复核" : "结果完整" },
                      { label: "下一步动作", done: selectedCandidateData.recommendedAction.variant === "success", desc: selectedCandidateData.recommendedAction.description },
                    ].map((step) => (
                      <div key={step.label} className="flex gap-3">
                        <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ${step.done ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                          {step.done ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{step.label}</p>
                          <p className="text-xs text-muted-foreground">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="border-border/40 bg-card/95 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">推荐动作</p>
                      <p className="text-xs text-muted-foreground">系统根据匹配结果给出当前最优下一步。</p>
                    </div>
                    <Zap className={`h-4 w-4 ${selectedCandidateData.recommendedAction.variant === "warning" ? "text-amber-500" : selectedCandidateData.recommendedAction.variant === "success" ? "text-emerald-500" : "text-primary"}`} />
                  </div>
                  <div className="mt-4 rounded-xl border border-border/40 bg-muted/20 p-3">
                    <p className="text-sm font-semibold">{selectedCandidateData.recommendedAction.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedCandidateData.recommendedAction.description}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleAnalyze(selectedCandidateData.candidate.id)} disabled={analyzing}>
                      {analyzing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}AI 重新分析
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleMatchAll(selectedCandidateData.candidate.id)} disabled={matchingAll}>
                      {matchingAll ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <BriefcaseBusiness className="mr-1 h-3 w-3" />}匹配全部职位
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.location.assign("/interviews")}>
                      安排面试
                    </Button>
                  </div>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <Card className="border-border/40 bg-card/95 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">匹配结果详情</p>
                      <p className="text-xs text-muted-foreground">默认聚焦最佳匹配，同时保留备选职位结果。</p>
                    </div>
                    <Select onValueChange={(jobId) => handleMatch(selectedCandidateData.candidate.id, jobId)} disabled={matching}>
                      <SelectTrigger className="h-8 w-44"><SelectValue placeholder={matching ? "匹配中..." : "匹配指定职位"} /></SelectTrigger>
                      <SelectContent>
                        {jobs.filter((job) => job.status === "active").map((job) => <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedCandidateData.candidate.matchedJobs?.length > 0 ? selectedCandidateData.candidate.matchedJobs
                      .slice()
                      .sort((left, right) => right.score - left.score)
                      .map((match, index) => (
                        <Card key={`${match.jobId}-${index}`} className={`border p-3 shadow-sm ${index === 0 ? "border-primary/40 bg-primary/5" : "border-border/50 bg-background/80"}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold">{match.jobTitle || match.jobId}</p>
                                {index === 0 && <Badge variant="secondary">最佳匹配</Badge>}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{match.reason || "暂无匹配说明"}</p>
                            </div>
                            <Badge variant="outline" className={`border-0 ${match.score >= 80 ? "bg-emerald-500/10 text-emerald-600" : match.score >= 60 ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"}`}>
                              {match.score} 分
                            </Badge>
                          </div>
                          {(match.pros?.length ?? 0) > 0 || (match.cons?.length ?? 0) > 0 ? (
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-[11px] font-semibold text-emerald-600">优势</p>
                                <div className="mt-1 space-y-1">
                                  {(match.pros || ["暂无总结"]).map((prosItem, itemIndex) => <p key={itemIndex} className="text-xs text-muted-foreground">+ {prosItem}</p>)}
                                </div>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold text-orange-600">风险</p>
                                <div className="mt-1 space-y-1">
                                  {(match.cons || ["暂无总结"]).map((consItem, itemIndex) => <p key={itemIndex} className="text-xs text-muted-foreground">- {consItem}</p>)}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </Card>
                      )) : (
                        <div className="rounded-xl border border-dashed border-border/50 px-4 py-10 text-center text-sm text-muted-foreground">
                          暂无匹配结果，请先执行智能匹配或指定职位匹配。
                        </div>
                      )}
                  </div>
                </Card>

                <div className="space-y-4">
                  <Card className="border-border/40 bg-card/95 p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Tags className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">标签</p>
                    </div>
                    <div className="mt-3">
                      <p className="text-[11px] text-muted-foreground">系统标签</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedCandidateData.systemTags.length > 0 ? selectedCandidateData.systemTags.map((tag) => (
                          <Badge key={tag} variant="secondary">{tag}</Badge>
                        )) : <span className="text-xs text-muted-foreground">暂无系统标签</span>}
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-[11px] text-muted-foreground">人工标签</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(selectedCandidateData.candidate.manualTags || []).map((tag) => (
                          <Badge key={tag} variant="outline" className="gap-1 pr-1">
                            {tag}
                            <button type="button" onClick={() => handleManualTagRemove(tag)} className="rounded-full p-0.5 hover:bg-muted">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                        {(selectedCandidateData.candidate.manualTags || []).length === 0 && <span className="text-xs text-muted-foreground">暂无人工标签</span>}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Input value={newManualTag} onChange={(e) => setNewManualTag(e.target.value)} placeholder="添加人工标签" />
                        <Button size="sm" onClick={handleManualTagAdd}>添加</Button>
                      </div>
                    </div>
                  </Card>

                  <Card className="border-border/40 bg-card/95 p-4 shadow-sm">
                    <p className="text-sm font-semibold">简历摘要</p>
                    {selectedCandidateData.candidate.resume?.parsedData?.summary ? (
                      <p className="mt-3 text-sm text-muted-foreground">{selectedCandidateData.candidate.resume.parsedData.summary}</p>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">暂无简历摘要，可尝试重新分析。</p>
                    )}
                    {(selectedCandidateData.candidate.resume?.parsedData?.skills?.length ?? 0) > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedCandidateData.candidate.resume?.parsedData?.skills?.slice(0, 12).map((skill) => <Badge key={skill} variant="outline">{skill}</Badge>)}
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Users className="h-8 w-8 text-primary/50" />
              </div>
              <p className="text-sm font-medium">从中间列表选择候选人查看匹配详情</p>
              <p className="mt-1 text-sm">左侧先确定优先级，中间列表执行批量操作，右侧处理单人决策。</p>
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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>编辑候选人信息</DialogTitle></DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">姓名</label>
                  <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">邮箱</label>
                  <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">手机</label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">简历摘要</label>
                <Textarea value={editForm.summary} onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })} className="min-h-[80px]" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">技能（用逗号分隔）</label>
                <Input value={editForm.skills} onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })} placeholder="Go, Docker, Kubernetes..." />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">工作经历</label>
                  <Button size="sm" variant="outline" onClick={addExperience}><Plus className="w-3 h-3 mr-1" />添加</Button>
                </div>
                {editForm.experience?.map((exp, i) => (
                  <Card key={i} className="p-3 space-y-2 relative">
                    <Button
                      size="sm" variant="ghost" className="absolute top-2 right-2 h-6 w-6 p-0"
                      onClick={() => removeExperience(i)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                    <div className="grid grid-cols-2 gap-2 pr-6">
                      <Input placeholder="公司" value={exp.company} onChange={(e) => updateExperience(i, "company", e.target.value)} />
                      <Input placeholder="职位" value={exp.position} onChange={(e) => updateExperience(i, "position", e.target.value)} />
                    </div>
                    <Input placeholder="工作时长（如：2020.01-2023.12）" value={exp.duration} onChange={(e) => updateExperience(i, "duration", e.target.value)} />
                    <Textarea placeholder="工作描述" value={exp.description} onChange={(e) => updateExperience(i, "description", e.target.value)} className="min-h-[60px]" />
                  </Card>
                ))}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">教育背景</label>
                  <Button size="sm" variant="outline" onClick={addEducation}><Plus className="w-3 h-3 mr-1" />添加</Button>
                </div>
                {editForm.education?.map((edu, i) => (
                  <Card key={i} className="p-3 space-y-2 relative">
                    <Button
                      size="sm" variant="ghost" className="absolute top-2 right-2 h-6 w-6 p-0"
                      onClick={() => removeEducation(i)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                    <div className="grid grid-cols-2 gap-2 pr-6">
                      <Input placeholder="学校" value={edu.school} onChange={(e) => updateEducation(i, "school", e.target.value)} />
                      <Input placeholder="学历（如：本科）" value={edu.degree} onChange={(e) => updateEducation(i, "degree", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="专业" value={edu.major} onChange={(e) => updateEducation(i, "major", e.target.value)} />
                      <Input placeholder="毕业时间（如：2020.06）" value={edu.graduation || ""} onChange={(e) => updateEducation(i, "graduation", e.target.value)} />
                    </div>
                  </Card>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>取消</Button>
                <Button onClick={handleSaveEdit} disabled={editing}>
                  {editing ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />保存中...</> : "保存"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
        <p className="text-sm text-muted-foreground mt-1">支持 PDF、Word（DOC/DOCX）、TXT 格式，可批量上传</p>
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
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-1 pr-4">
              {results.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${r.success ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}`}>
                  {r.success ? <FileText className="w-4 h-4 text-green-600" /> : <span className="text-red-600">✗</span>}
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground text-xs">{r.message}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
          <Button variant="outline" size="sm" className="w-full" onClick={handleDone}>完成</Button>
        </div>
      )}
    </div>
  );
}
