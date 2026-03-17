"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase, Users, Calendar, FileText, TrendingUp, Sparkles, Bot,
} from "lucide-react";
import type { Job, Candidate, Interview } from "@/lib/types";

interface Stats {
  activeJobs: number;
  totalCandidates: number;
  todayInterviews: number;
  pendingItems: number;
}

const STAT_CONFIG = [
  { label: "活跃职位", key: "activeJobs" as const, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/50" },
  { label: "候选人", key: "totalCandidates" as const, icon: Users, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/50" },
  { label: "今日面试", key: "todayInterviews" as const, icon: Calendar, color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/50" },
  { label: "待处理", key: "pendingItems" as const, icon: FileText, color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/50" },
];

export function InfoPanel() {
  const pathname = usePathname();
  const [stats, setStats] = useState<Stats>({ activeJobs: 0, totalCandidates: 0, todayInterviews: 0, pendingItems: 0 });
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [recentCandidates, setRecentCandidates] = useState<Candidate[]>([]);
  const [upcomingInterviews, setUpcomingInterviews] = useState<Interview[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [jobsRes, candidatesRes, interviewsRes] = await Promise.allSettled([
        fetch("/api/jobs").then((r) => r.json()),
        fetch("/api/candidates").then((r) => r.json()),
        fetch("/api/interviews").then((r) => r.json()),
      ]);
      const jobs: Job[] = jobsRes.status === "fulfilled" ? jobsRes.value.jobs || [] : [];
      const candidates: Candidate[] = candidatesRes.status === "fulfilled" ? candidatesRes.value.candidates || [] : [];
      const interviews: Interview[] = interviewsRes.status === "fulfilled" ? interviewsRes.value.interviews || [] : [];
      const today = new Date().toDateString();
      setStats({
        activeJobs: jobs.filter((j) => j.status === "active").length,
        totalCandidates: candidates.length,
        todayInterviews: interviews.filter((i) => new Date(i.scheduledTime).toDateString() === today && i.status === "scheduled").length,
        pendingItems: candidates.filter((c) => c.status === "pending").length + interviews.filter((i) => i.status === "scheduled").length,
      });
      setRecentJobs(jobs.slice(0, 5));
      setRecentCandidates(candidates.slice(0, 5));
      setUpcomingInterviews(interviews.filter((i) => i.status === "scheduled").sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()).slice(0, 5));
    } catch {}
  };

  return (
    <div className="w-72 border-l border-border bg-card/50 flex flex-col min-h-0 overflow-hidden">
      <div className="h-14 border-b border-border px-4 flex items-center justify-between glass">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">数据概览</h2>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {STAT_CONFIG.map(({ label, key, icon: Icon, color, bg }) => (
              <Card key={label} className="p-3 gradient-card hover:shadow-md transition-all duration-300">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className="text-xl font-bold">{stats[key]}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </Card>
            ))}
          </div>

          {/* Quick actions on chat page */}
          {pathname === "/" && (
            <div>
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                快捷操作
              </h3>
              <div className="space-y-1.5">
                {[
                  { icon: Sparkles, label: "生成 JD", desc: "\"招一个Go后端\"" },
                  { icon: FileText, label: "分析简历", desc: "拖入PDF文件" },
                  { icon: Calendar, label: "安排面试", desc: "\"给张三安排面试\"" },
                  { icon: Bot, label: "自由对话", desc: "任何HR问题" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-accent transition-colors cursor-default">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Jobs */}
          {recentJobs.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">最近职位</h3>
              <div className="space-y-1.5">
                {recentJobs.map((job) => (
                  <Card key={job.id} className="p-2.5 hover:shadow-sm transition-all duration-200">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{job.title}</p>
                        <p className="text-[10px] text-muted-foreground">{job.department}</p>
                      </div>
                      <Badge variant={job.status === "active" ? "default" : "secondary"} className="text-[9px] h-4 px-1 shrink-0">
                        {job.status === "active" ? "招聘中" : job.status === "draft" ? "草稿" : job.status === "paused" ? "暂停" : "已关闭"}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Interviews */}
          {upcomingInterviews.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">即将面试</h3>
              <div className="space-y-1.5">
                {upcomingInterviews.map((interview) => (
                  <Card key={interview.id} className="p-2.5 hover:shadow-sm transition-all duration-200">
                    <p className="text-xs font-medium truncate">{interview.candidateName || interview.candidateId}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(interview.scheduledTime).toLocaleDateString()} {new Date(interview.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Recent Candidates */}
          {recentCandidates.length > 0 && pathname.startsWith("/candidates") && (
            <div>
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">最近候选人</h3>
              <div className="space-y-1.5">
                {recentCandidates.map((c) => (
                  <Card key={c.id} className="p-2.5 hover:shadow-sm transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium">{c.name}</p>
                      {c.matchedJobs?.[0] && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 text-primary border-primary/30">{c.matchedJobs[0].score}分</Badge>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
