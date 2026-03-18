"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar, GraduationCap, Award,
  Briefcase, FileText, CheckCircle, XCircle,
} from "lucide-react";
import type { Candidate, JobMatch } from "@/lib/types";

interface CandidateDetailContentProps {
  candidate: Candidate;
  match?: JobMatch;
  actions?: {
    onScheduleInterview?: () => void;
    onUpdateStatus?: () => void;
    onViewResume?: () => void;
  };
}

const getScoreTextColor = (score: number) => {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
};

const getScoreBgColor = (score: number) => {
  if (score >= 80) return "bg-green-100 dark:bg-green-900/30";
  if (score >= 60) return "bg-amber-100 dark:bg-amber-900/30";
  return "bg-red-100 dark:bg-red-900/30";
};

export function CandidateDetailContent({
  candidate,
  match,
  actions,
}: CandidateDetailContentProps) {
  const parsedData = candidate.resume?.parsedData;

  return (
    <div className="space-y-6">
      {/* Match Analysis Card */}
      {match && (
        <div className={`p-4 rounded-lg border ${getScoreBgColor(match.score)} border-l-4 ${
          match.score >= 80 ? "border-green-500" : match.score >= 60 ? "border-amber-500" : "border-red-500"
        }`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">匹配分析</h3>
            <div className={`text-2xl font-bold ${getScoreTextColor(match.score)}`}>
              {match.score}分
            </div>
          </div>

          {match.reason && (
            <p className="text-xs text-muted-foreground mb-3">{match.reason}</p>
          )}

          {((match.pros?.length ?? 0) > 0 || (match.cons?.length ?? 0) > 0) && (
            <div className="space-y-3">
              {(match.pros?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    优势
                  </p>
                  <div className="space-y-1">
                    {match.pros!.map((p, i) => (
                      <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="shrink-0 text-green-600 mt-0.5">•</span>
                        <span>{p}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {(match.cons?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    风险
                  </p>
                  <div className="space-y-1">
                    {match.cons!.map((c, i) => (
                      <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="shrink-0 text-orange-600 mt-0.5">•</span>
                        <span>{c}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Detail Tabs */}
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summary">简历摘要</TabsTrigger>
          <TabsTrigger value="experience">工作经历</TabsTrigger>
          <TabsTrigger value="education">教育背景</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4 space-y-4">
          {parsedData?.summary && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                个人简介
              </h4>
              <p className="text-sm text-muted-foreground">{parsedData.summary}</p>
            </div>
          )}

          {parsedData?.skills && parsedData.skills.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Award className="w-4 h-4" />
                技能标签
              </h4>
              <div className="flex flex-wrap gap-2">
                {parsedData.skills.map((skill, i) => (
                  <Badge key={i} variant="secondary">{skill}</Badge>
                ))}
              </div>
            </div>
          )}

          {parsedData?.projects && parsedData.projects.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">项目经验</h4>
              <div className="space-y-3">
                {parsedData.projects.map((project, i) => (
                  <div key={i} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-semibold">{project.name}</p>
                      {project.duration && (
                        <p className="text-xs text-muted-foreground">{project.duration}</p>
                      )}
                    </div>
                    {project.role && (
                      <p className="text-xs text-muted-foreground mb-2">{project.role}</p>
                    )}
                    {project.description && (
                      <p className="text-xs text-muted-foreground mb-2">{project.description}</p>
                    )}
                    {project.technologies && project.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {project.technologies.map((tech, j) => (
                          <Badge key={j} variant="outline" className="text-[10px]">
                            {tech}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="experience" className="mt-4 space-y-4">
          {parsedData?.experience && parsedData.experience.length > 0 ? (
            parsedData.experience.map((exp, i) => (
              <div key={i} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      {exp.position}
                    </h4>
                    <p className="text-xs text-muted-foreground">{exp.company}</p>
                  </div>
                  {exp.duration && (
                    <p className="text-xs text-muted-foreground">{exp.duration}</p>
                  )}
                </div>
                {exp.description && (
                  <p className="text-xs text-muted-foreground mt-2">{exp.description}</p>
                )}
                {exp.achievements && exp.achievements.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold mb-1">主要成就</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {exp.achievements.map((achievement, j) => (
                        <li key={j}>• {achievement}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">暂无工作经历</p>
          )}
        </TabsContent>

        <TabsContent value="education" className="mt-4 space-y-4">
          {parsedData?.education && parsedData.education.length > 0 ? (
            parsedData.education.map((edu, i) => (
              <div key={i} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      {edu.school}
                    </h4>
                    <p className="text-xs text-muted-foreground">{edu.degree} · {edu.major}</p>
                  </div>
                  {edu.graduation && (
                    <p className="text-xs text-muted-foreground">{edu.graduation}</p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">暂无教育背景</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      {actions && (
        <div className="flex gap-2 pt-4 border-t">
          {actions.onScheduleInterview && (
            <Button size="sm" onClick={actions.onScheduleInterview} className="flex-1">
              <Calendar className="w-4 h-4 mr-1" />
              安排面试
            </Button>
          )}
          {actions.onUpdateStatus && (
            <Button size="sm" variant="outline" onClick={actions.onUpdateStatus} className="flex-1">
              更新状态
            </Button>
          )}
          {actions.onViewResume && (
            <Button size="sm" variant="outline" onClick={actions.onViewResume}>
              <FileText className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
