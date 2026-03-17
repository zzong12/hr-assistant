"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VoiceAssistant } from "@/components/VoiceAssistant";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  MessageSquare,
  CheckCircle,
  XCircle,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import type { Interview, Job, Candidate, EvaluationPreset } from "@/lib/types";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "已安排", variant: "default" },
  completed: { label: "已完成", variant: "secondary" },
  cancelled: { label: "已取消", variant: "destructive" },
};

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [evaluationPresets, setEvaluationPresets] = useState<EvaluationPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"info" | "questions" | "voice">("info");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const presetsJson = data.evaluation_presets;
        if (presetsJson) {
          try {
            const presets = JSON.parse(presetsJson);
            setEvaluationPresets(Array.isArray(presets) ? presets : []);
          } catch {
            setEvaluationPresets([]);
          }
        }
      })
      .catch(() => setEvaluationPresets([]));
  }, []);

  const loadData = async () => {
    try {
      const [intRes, jobRes, candRes] = await Promise.all([
        fetch("/api/interviews").then((r) => r.json()),
        fetch("/api/jobs").then((r) => r.json()),
        fetch("/api/candidates").then((r) => r.json()),
      ]);
      setInterviews(intRes.interviews || []);
      setJobs(jobRes.jobs || []);
      setCandidates(candRes.candidates || []);
    } catch {
      toast.error("加载数据失败");
    } finally {
      setLoading(false);
    }
  };

  const getCandidateName = (candidateId: string) =>
    candidates.find((c) => c.id === candidateId)?.name || candidateId;

  const getJobTitle = (jobId: string) =>
    jobs.find((j) => j.id === jobId)?.title || jobId;

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/interviews?id=${id}`, { method: "DELETE" });
      setInterviews(interviews.filter((i) => i.id !== id));
      if (selectedInterview?.id === id) setSelectedInterview(null);
      toast.success("面试已删除");
    } catch {
      toast.error("删除失败");
    }
  };

  const handleCancel = async (interview: Interview) => {
    try {
      const res = await fetch("/api/interviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: interview.id, status: "cancelled" }),
      });
      if (res.ok) {
        const updated = await res.json();
        setInterviews(interviews.map((i) => (i.id === interview.id ? updated : i)));
        if (selectedInterview?.id === interview.id) setSelectedInterview(updated);
        toast.success("面试已取消");
      }
    } catch {
      toast.error("操作失败");
    }
  };

  const handleGenerateQuestions = async (interview: Interview) => {
    setGeneratingQuestions(true);
    try {
      const res = await fetch(
        `/api/interviews/${interview.id}/generate-questions`,
        { method: "POST" }
      );
      if (res.ok) {
        const updated = await res.json();
        setInterviews(interviews.map((i) => (i.id === interview.id ? updated : i)));
        setSelectedInterview(updated);
        toast.success("面试题已生成");
      } else {
        toast.error("生成失败");
      }
    } catch {
      toast.error("AI生成面试题失败");
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const filteredInterviews = interviews.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Left: List */}
      <div className="w-96 border-r border-border flex flex-col min-h-0 overflow-hidden">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">面试管理</h1>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  安排面试
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>安排新面试</DialogTitle>
                </DialogHeader>
                <CreateInterviewForm
                  jobs={jobs}
                  candidates={candidates}
                  evaluationPresets={evaluationPresets}
                  onSuccess={() => {
                    setIsCreateDialogOpen(false);
                    loadData();
                  }}
                  onCancel={() => setIsCreateDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="筛选状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="scheduled">已安排</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="cancelled">已取消</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {filteredInterviews.map((interview) => (
              <Card
                key={interview.id}
                className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedInterview?.id === interview.id ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setSelectedInterview(interview)}
              >
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-medium text-sm">
                    {getCandidateName(interview.candidateId)}
                  </h3>
                  <Badge
                    variant={STATUS_CONFIG[interview.status]?.variant || "outline"}
                    className="text-[10px]"
                  >
                    {STATUS_CONFIG[interview.status]?.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  {getJobTitle(interview.jobId)}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(interview.scheduledTime).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(interview.scheduledTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </Card>
            ))}

            {filteredInterviews.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-primary/50" />
                </div>
                <p className="text-sm">暂无面试安排</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right: Detail */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {selectedInterview ? (
          <>
            <div className="p-6 border-b border-border">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-1">
                    {getCandidateName(selectedInterview.candidateId)}
                  </h2>
                  <div className="flex gap-2 items-center">
                    <Badge
                      variant={STATUS_CONFIG[selectedInterview.status]?.variant || "outline"}
                    >
                      {STATUS_CONFIG[selectedInterview.status]?.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {getJobTitle(selectedInterview.jobId)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {selectedInterview.status === "scheduled" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsFeedbackDialogOpen(true)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        填写反馈
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel(selectedInterview)}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        取消
                      </Button>
                    </>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(selectedInterview.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 p-6">
              <div className="max-w-3xl space-y-6">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "info" | "questions" | "voice")}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="info">面试信息</TabsTrigger>
                    <TabsTrigger value="questions">面试题</TabsTrigger>
                    {selectedInterview.status === "scheduled" && selectedInterview.questions.length > 0 && (
                      <TabsTrigger value="voice">
                        <Sparkles className="w-4 h-4 mr-1" />AI 面试助手
                      </TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="info">
                {/* Info */}
                <Card className="p-5">
                  <h3 className="text-base font-semibold mb-4">面试信息</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-xs text-muted-foreground">候选人</div>
                        <div className="text-sm font-medium">
                          {getCandidateName(selectedInterview.candidateId)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-xs text-muted-foreground">时间</div>
                        <div className="text-sm font-medium">
                          {new Date(selectedInterview.scheduledTime).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-xs text-muted-foreground">地点</div>
                        <div className="text-sm font-medium">
                          {selectedInterview.location}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-xs text-muted-foreground">面试官</div>
                        <div className="text-sm font-medium">
                          {selectedInterview.interviewer}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
                  </TabsContent>

                  <TabsContent value="questions">
                {/* Questions */}
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold">面试题</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateQuestions(selectedInterview)}
                      disabled={generatingQuestions}
                    >
                      {generatingQuestions ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-1" />
                      )}
                      AI生成面试题
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {selectedInterview.questions.map((q, i) => (
                      <div key={i} className="border-l-2 border-primary pl-3">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge variant="outline" className="text-[10px]">
                            {q.category}
                          </Badge>
                          {q.difficulty && (
                            <Badge variant="secondary" className="text-[10px]">
                              {q.difficulty === "easy"
                                ? "简单"
                                : q.difficulty === "medium"
                                ? "中等"
                                : "困难"}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm">{q.question}</div>
                        {q.purpose && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            考察: {q.purpose}
                          </div>
                        )}
                        {q.keyPoints && q.keyPoints.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase">回答关键点</p>
                            {q.keyPoints.map((kp, kpi) => (
                              <div key={kpi} className="flex items-start gap-1.5 text-xs">
                                <Badge variant="outline" className={`text-[9px] h-4 px-1 shrink-0 ${
                                  kp.level === "expert" ? "border-amber-500 text-amber-600" :
                                  kp.level === "advanced" ? "border-purple-500 text-purple-600" :
                                  kp.level === "intermediate" ? "border-blue-500 text-blue-600" :
                                  "border-gray-400 text-gray-500"
                                }`}>
                                  {kp.level === "expert" ? "专家" : kp.level === "advanced" ? "高级" : kp.level === "intermediate" ? "中级" : "基础"}
                                </Badge>
                                <div>
                                  <span className="font-medium">{kp.point}</span>
                                  <span className="text-muted-foreground ml-1">— {kp.explanation}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {selectedInterview.questions.length === 0 && (
                      <div className="text-center text-muted-foreground py-4">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                          <MessageSquare className="w-8 h-8 text-primary/50" />
                        </div>
                        <p className="text-xs">暂无面试题，请点击AI生成</p>
                      </div>
                    )}
                  </div>
                </Card>
                  </TabsContent>

                  {/* Voice Assistant */}
                  {selectedInterview.status === "scheduled" && selectedInterview.questions.length > 0 && (
                    <TabsContent value="voice">
                      <div>
                        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary" />AI 面试助手
                        </h3>
                        <VoiceAssistant
                          interviewId={selectedInterview.id}
                          questions={selectedInterview.questions}
                          onTranscriptSave={async (transcript) => {
                            try {
                              const res = await fetch(`/api/interviews`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: selectedInterview.id, transcript }),
                              });
                              if (res.ok) loadData();
                            } catch {}
                          }}
                        />
                      </div>
                    </TabsContent>
                  )}
                </Tabs>

                {/* Feedback */}
                {selectedInterview.feedback && (
                  <Card className="p-5">
                    <h3 className="text-base font-semibold mb-4">面试反馈</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {[
                        { label: "技术", score: selectedInterview.feedback.technicalScore },
                        { label: "沟通", score: selectedInterview.feedback.communicationScore },
                        { label: "解决问题", score: selectedInterview.feedback.problemSolvingScore },
                        { label: "综合", score: selectedInterview.feedback.overallScore },
                      ].map(
                        (item) =>
                          item.score != null && (
                            <div key={item.label}>
                              <div className="text-xs text-muted-foreground">
                                {item.label}
                              </div>
                              <div className="text-2xl font-bold">{item.score}</div>
                            </div>
                          )
                      )}
                    </div>

                    <div className="space-y-3">
                      {selectedInterview.feedback.strengths &&
                        selectedInterview.feedback.strengths.length > 0 && (
                          <div>
                            <div className="text-xs font-medium mb-1 text-green-600">
                              优势
                            </div>
                            <ul className="text-sm space-y-0.5 text-muted-foreground">
                              {selectedInterview.feedback.strengths.map((s, i) => (
                                <li key={i}>• {s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      {selectedInterview.feedback.concerns &&
                        selectedInterview.feedback.concerns.length > 0 && (
                          <div>
                            <div className="text-xs font-medium mb-1 text-orange-600">
                              关注点
                            </div>
                            <ul className="text-sm space-y-0.5 text-muted-foreground">
                              {selectedInterview.feedback.concerns.map((c, i) => (
                                <li key={i}>• {c}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      {selectedInterview.feedback.notes && (
                        <div>
                          <div className="text-xs font-medium mb-1">备注</div>
                          <p className="text-sm text-muted-foreground">
                            {selectedInterview.feedback.notes}
                          </p>
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-medium mb-1">推荐决策</div>
                        <Badge
                          variant={
                            selectedInterview.feedback.recommendation === "strong_hire" ||
                            selectedInterview.feedback.recommendation === "hire"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {
                            {
                              strong_hire: "强烈推荐",
                              hire: "推荐录用",
                              no_hire: "不推荐",
                              strong_no_hire: "强烈不推荐",
                            }[selectedInterview.feedback.recommendation]
                          }
                        </Badge>
                      </div>
                    {(selectedInterview.feedback?.pros?.length ?? 0) > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-green-600 mb-1">正面评价</p>
                        {selectedInterview.feedback!.pros!.map((p, i) => (
                          <p key={i} className="text-xs text-muted-foreground">+ {p}</p>
                        ))}
                      </div>
                    )}
                    {(selectedInterview.feedback?.cons?.length ?? 0) > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-orange-600 mb-1">风险/不足</p>
                        {selectedInterview.feedback!.cons!.map((c, i) => (
                          <p key={i} className="text-xs text-muted-foreground">- {c}</p>
                        ))}
                      </div>
                    )}
                    </div>
                  </Card>
                )}
              </div>
            </ScrollArea>

            {/* Feedback Dialog */}
            <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>填写面试反馈</DialogTitle>
                </DialogHeader>
                <FeedbackForm
                  interview={selectedInterview}
                  onSuccess={(updated) => {
                    setIsFeedbackDialogOpen(false);
                    setInterviews(
                      interviews.map((i) =>
                        i.id === updated.id ? updated : i
                      )
                    );
                    setSelectedInterview(updated);
                  }}
                  onCancel={() => setIsFeedbackDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-primary/50" />
              </div>
              <p>选择一个面试查看详情</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Create Interview Form ====================

const getNextWorkday = () => {
  const d = new Date();
  d.setDate(d.getDate() + (d.getDay() === 0 || d.getDay() === 6 ? (d.getDay() === 0 ? 1 : 2) : 1));
  d.setHours(10, 0, 0, 0);
  return d.toISOString().slice(0, 16);
};

function CreateInterviewForm({
  jobs,
  candidates,
  evaluationPresets,
  onSuccess,
  onCancel,
}: {
  jobs: Job[];
  candidates: Candidate[];
  evaluationPresets: EvaluationPreset[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [jobId, setJobId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [scheduledTime, setScheduledTime] = useState(getNextWorkday());
  const [location, setLocation] = useState("");
  const [interviewer, setInterviewer] = useState("");
  const [evaluationPresetId, setEvaluationPresetId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId || !candidateId) {
      toast.error("请选择职位和候选人");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          candidateId,
          scheduledTime: new Date(scheduledTime).toISOString(),
          location,
          interviewer,
          autoGenerate: true,
          evaluationPresetId: evaluationPresetId || undefined,
        }),
      });

      if (res.ok) {
        toast.success("面试已安排");
        onSuccess();
      } else {
        const data = await res.json();
        toast.error(data.error || "创建失败");
      }
    } catch {
      toast.error("操作失败");
    } finally {
      setLoading(false);
    }
  };

  const activeJobs = jobs.filter((j) => j.status === "active");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>候选人 *</Label>
        <Select value={candidateId} onValueChange={setCandidateId}>
          <SelectTrigger>
            <SelectValue placeholder="选择候选人" />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} ({c.contact.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>面试职位 *</Label>
        <Select value={jobId} onValueChange={setJobId}>
          <SelectTrigger>
            <SelectValue placeholder="选择职位" />
          </SelectTrigger>
          <SelectContent>
            {activeJobs.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.title} ({j.department})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>面试时间 *</Label>
        <Input
          type="datetime-local"
          value={scheduledTime}
          onChange={(e) => setScheduledTime(e.target.value)}
          required
        />
      </div>

      <div>
        <Label>面试地点 *</Label>
        <div className="flex flex-wrap gap-1 mb-1">
          {["线上-腾讯会议", "线上-飞书", "线下-会议室A", "线下-会议室B"].map((loc) => (
            <Button key={loc} type="button" variant="outline" size="sm" className="text-xs h-6 transition-colors"
              onClick={() => setLocation(loc)}>{loc}</Button>
          ))}
        </div>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="会议室或线上链接"
          required
        />
      </div>

      <div>
        <Label>面试官 *</Label>
        <Input
          value={interviewer}
          onChange={(e) => setInterviewer(e.target.value)}
          placeholder="面试官姓名"
          required
        />
      </div>

      {evaluationPresets.length > 0 && (
        <div>
          <Label>评估维度预设</Label>
          <Select value={evaluationPresetId} onValueChange={setEvaluationPresetId}>
            <SelectTrigger>
              <SelectValue placeholder="选择评估预设（可选）" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">无</SelectItem>
              {evaluationPresets.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          取消
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
          创建
        </Button>
      </div>
    </form>
  );
}

// ==================== Feedback Form ====================

function FeedbackForm({
  interview,
  onSuccess,
  onCancel,
}: {
  interview: Interview;
  onSuccess: (updated: Interview) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [freeTextFeedback, setFreeTextFeedback] = useState("");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [technicalScore, setTechnicalScore] = useState("70");
  const [communicationScore, setCommunicationScore] = useState("70");
  const [problemSolvingScore, setProblemSolvingScore] = useState("70");
  const [overallScore, setOverallScore] = useState("70");
  const [strengths, setStrengths] = useState("");
  const [concerns, setConcerns] = useState("");
  const [notes, setNotes] = useState("");
  const [recommendation, setRecommendation] = useState("hire");
  const [loading, setLoading] = useState(false);

  const handleAiFeedback = async () => {
    setAiAnalyzing(true);
    try {
      const res = await fetch(`/api/interviews/${interview.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeText: freeTextFeedback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("反馈已提交");
      onSuccess(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "提交失败");
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/interviews/${interview.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicalScore: Number(technicalScore),
          communicationScore: Number(communicationScore),
          problemSolvingScore: Number(problemSolvingScore),
          overallScore: Number(overallScore),
          strengths: strengths
            .split("\n")
            .filter(Boolean),
          concerns: concerns
            .split("\n")
            .filter(Boolean),
          notes,
          recommendation,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        toast.success("反馈已提交");
        onSuccess(updated);
      } else {
        toast.error("提交失败");
      }
    } catch {
      toast.error("提交失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2 mb-4">
        <Button type="button" variant={mode === "ai" ? "default" : "outline"} size="sm" onClick={() => setMode("ai")}>
          <Sparkles className="w-3 h-3 mr-1" />AI评估模式
        </Button>
        <Button type="button" variant={mode === "manual" ? "default" : "outline"} size="sm" onClick={() => setMode("manual")}>
          手动打分模式
        </Button>
      </div>

      {mode === "ai" ? (
        <div className="space-y-3">
          <Textarea
            placeholder="用自然语言描述面试表现，AI会自动提取评分。例如：&#10;技术很扎实，Go和微服务很熟悉，项目经验丰富。沟通表达清晰，逻辑性强。总体建议录用。"
            value={freeTextFeedback}
            onChange={(e) => setFreeTextFeedback(e.target.value)}
            className="min-h-[120px]"
          />
          <Button type="button" onClick={handleAiFeedback} disabled={aiAnalyzing || !freeTextFeedback.trim()} className="w-full">
            {aiAnalyzing ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />AI分析中...</> : <>AI 提取评分并提交</>}
          </Button>
        </div>
      ) : (
        <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>技术能力 (0-100)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={technicalScore}
            onChange={(e) => setTechnicalScore(e.target.value)}
          />
        </div>
        <div>
          <Label>沟通能力 (0-100)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={communicationScore}
            onChange={(e) => setCommunicationScore(e.target.value)}
          />
        </div>
        <div>
          <Label>问题解决 (0-100)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={problemSolvingScore}
            onChange={(e) => setProblemSolvingScore(e.target.value)}
          />
        </div>
        <div>
          <Label>综合评分 (0-100)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={overallScore}
            onChange={(e) => setOverallScore(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label>优势（每行一条）</Label>
        <Textarea
          value={strengths}
          onChange={(e) => setStrengths(e.target.value)}
          placeholder="技术基础扎实&#10;沟通表达清晰"
          rows={3}
        />
      </div>

      <div>
        <Label>关注点（每行一条）</Label>
        <Textarea
          value={concerns}
          onChange={(e) => setConcerns(e.target.value)}
          placeholder="项目经验较少&#10;..."
          rows={3}
        />
      </div>

      <div>
        <Label>备注</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="其他备注信息..."
          rows={2}
        />
      </div>

      <div>
        <Label>推荐决策</Label>
        <Select value={recommendation} onValueChange={setRecommendation}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="strong_hire">强烈推荐录用</SelectItem>
            <SelectItem value="hire">推荐录用</SelectItem>
            <SelectItem value="no_hire">不推荐</SelectItem>
            <SelectItem value="strong_no_hire">强烈不推荐</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          取消
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
          提交反馈
        </Button>
      </div>
        </>
      )}
    </form>
  );
}
