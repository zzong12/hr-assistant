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
  { label: "活跃职位", key: "activeJobs" as const, icon: Briefcase, color: "text-blue-500", bg: "bg-blue-500/10" },
  { label: "候选人", key: "totalCandidates" as const, icon: Users, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { label: "今日面试", key: "todayInterviews" as const, icon: Calendar, color: "text-purple-500", bg: "bg-purple-500/10" },
  { label: "待处理", key: "pendingItems" as const, icon: FileText, color: "text-orange-500", bg: "bg-orange-500/10" },
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
    <div className="hidden lg:flex w-[300px] border-l border-border/40 bg-background/40 backdrop-blur-3xl flex-col min-h-0 overflow-hidden shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.05)]">
      <div className="h-16 px-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-sm font-bold tracking-wide">数据看板</h2>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-5 pt-0 space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {STAT_CONFIG.map(({ label, key, icon: Icon, color, bg }) => (
              <div key={label} className="p-4 rounded-2xl bg-card border border-border/30 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <p className="text-2xl font-black font-mono tracking-tight">{stats[key]}</p>
                <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Quick actions on chat page */}
          {pathname === "/" && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold text-foreground">快速指令</h3>
              </div>
              <div className="space-y-2">
                {[
                  { icon: Briefcase, label: "生成 JD", desc: '"招一个Go后端"' },
                  { icon: FileText, label: "分析简历", desc: "拖拽/粘贴内容" },
                  { icon: Calendar, label: "安排面试", desc: '"给张三安排面试"' },
                  { icon: Bot, label: "自由对话", desc: "询问任何HR问题" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/20 bg-muted/20 hover:bg-primary/5 hover:border-primary/20 transition-all cursor-default group">
                    <div className="w-8 h-8 rounded-lg bg-background shadow-sm border border-border/50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{label}</p>
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
              <h3 className="text-xs font-bold text-foreground mb-3 px-1">最近发布</h3>
              <div className="space-y-2">
                {recentJobs.map((job) => (
                  <div key={job.id} className="group relative p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{job.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{job.department}</p>
                      </div>
                      <Badge variant="outline" className={`text-[9px] h-5 px-1.5 shrink-0 rounded-full border-0 ${job.status === "active" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                        {job.status === "active" ? "招聘中" : job.status === "draft" ? "草稿" : "已暂停"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Interviews */}
          {upcomingInterviews.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-foreground mb-3 px-1">日程安排</h3>
              <div className="space-y-2">
                {upcomingInterviews.map((interview) => {
                  const date = new Date(interview.scheduledTime);
                  return (
                    <div key={interview.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-purple-600 uppercase">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                        <span className="text-xs font-black text-purple-700">{date.getDate()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{interview.candidateName || interview.candidateId}</p>
                        <p className="text-[11px] text-muted-foreground">{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
