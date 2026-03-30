import type {
  Candidate,
  CandidateMatchProgress,
  Interview,
  InterviewStatus,
  Job,
  JobMatch,
} from "./types.ts";

export interface CandidateRecommendedAction {
  label: string;
  description: string;
  action: "match" | "review" | "schedule_interview" | "advance_status" | "maintain";
  variant: "default" | "success" | "warning";
}

export interface CandidateWorkbenchData {
  candidate: Candidate;
  progress: CandidateMatchProgress;
  bestMatch?: JobMatch;
  systemTags: string[];
  allTags: string[];
  recommendedAction: CandidateRecommendedAction;
}

function getCandidateInterviewContext(candidateId: string, interviews: Interview[]) {
  const relatedInterviews = interviews.filter((interview) => interview.candidateId === candidateId);
  const hasActiveInterview = relatedInterviews.some((interview) => !interview.archived && interview.status === "scheduled");
  const hasArchivedInterview = relatedInterviews.some((interview) => !!interview.archived);
  const hasHistoricalInterview = relatedInterviews.some((interview) => interview.status === "completed" || interview.status === "cancelled");

  return {
    hasActiveInterview,
    hasArchivedInterview,
    hasHistoricalInterview,
  };
}

export interface InterviewArchiveState {
  canArchive: boolean;
  canRestore: boolean;
  isArchived: boolean;
  archiveSourceStatus?: Extract<InterviewStatus, "completed" | "cancelled">;
}

function getLatestAssessedAt(matches: JobMatch[]): Date | undefined {
  const timestamps = matches
    .map((match) => (match.assessedAt ? new Date(match.assessedAt).getTime() : undefined))
    .filter((value): value is number => typeof value === "number" && !Number.isNaN(value));

  if (timestamps.length === 0) return undefined;
  return new Date(Math.max(...timestamps));
}

function getBestMatch(matches: JobMatch[]): JobMatch | undefined {
  return [...matches].sort((left, right) => right.score - left.score)[0];
}

export function deriveCandidateMatchProgress(candidate: Candidate, jobs: Job[]): CandidateMatchProgress {
  const activeJobs = jobs.filter((job) => job.status === "active");
  const totalJobCount = activeJobs.length;
  const matchedJobCount = candidate.matchedJobs?.length ?? 0;
  const lastMatchedAt = getLatestAssessedAt(candidate.matchedJobs || []);
  const hasCoverageGap = totalJobCount > 0 && matchedJobCount > 0 && matchedJobCount < totalJobCount;
  const missingContact = !candidate.contact?.email && !candidate.contact?.phone && !candidate.contact?.wechat;
  const bestMatch = getBestMatch(candidate.matchedJobs || []);
  const needsReview = hasCoverageGap || missingContact || (matchedJobCount > 0 && !bestMatch?.reason);

  let status: CandidateMatchProgress["status"] = "not_started";

  if (candidate.matchProgress?.status === "matching") {
    status = "matching";
  } else if (matchedJobCount === 0) {
    status = "not_started";
  } else if (needsReview) {
    status = "needs_review";
  } else {
    status = "completed";
  }

  return {
    status,
    matchedJobCount,
    totalJobCount,
    lastMatchedAt,
    needsReview,
  };
}

export function getCandidateSystemTags(candidate: Candidate, progress: CandidateMatchProgress, interviews: Interview[] = []): string[] {
  const tags = new Set<string>();
  const bestMatch = getBestMatch(candidate.matchedJobs || []);
  const interviewContext = getCandidateInterviewContext(candidate.id, interviews);

  if (progress.status === "not_started") tags.add("未匹配");
  if (progress.status === "matching") tags.add("匹配中");
  if (progress.needsReview) tags.add("待复核");
  if ((candidate.matchedJobs?.length ?? 0) >= 2) tags.add("多岗位可投");
  if ((bestMatch?.score ?? -1) >= 85) tags.add("高匹配");
  if ((bestMatch?.score ?? -1) >= 75 && ["screening", "interview"].includes(candidate.status) && !interviewContext.hasActiveInterview) {
    tags.add("待安排面试");
  }
  if (!candidate.contact?.email && !candidate.contact?.phone && !candidate.contact?.wechat) {
    tags.add("待补充信息");
  }

  return [...tags];
}

export function getCandidateRecommendedAction(
  candidate: Candidate,
  progress: CandidateMatchProgress,
  interviews: Interview[] = [],
): CandidateRecommendedAction {
  const bestMatch = getBestMatch(candidate.matchedJobs || []);
  const interviewContext = getCandidateInterviewContext(candidate.id, interviews);

  if (progress.status === "not_started") {
    return {
      label: "开始匹配",
      description: "候选人还没有有效匹配结果，建议先执行匹配。",
      action: "match",
      variant: "default",
    };
  }

  if (progress.status === "needs_review") {
    return {
      label: "复核匹配结果",
      description: "当前结果未覆盖全部活跃职位或缺少关键信息，建议优先复核。",
      action: "review",
      variant: "warning",
    };
  }

  if ((bestMatch?.score ?? -1) >= 85 && candidate.status !== "interview" && !interviewContext.hasActiveInterview) {
    return {
      label: "推进到面试",
      description: `最佳匹配 ${bestMatch?.jobTitle || "目标职位"} 分值较高，建议安排下一步。`,
      action: "schedule_interview",
      variant: "success",
    };
  }

  if ((bestMatch?.score ?? -1) >= 85 && candidate.status === "interview" && !interviewContext.hasActiveInterview) {
    if (interviewContext.hasArchivedInterview || interviewContext.hasHistoricalInterview) {
      return {
        label: "安排下一轮面试",
        description: "已有历史面试记录，但流程仍可继续推进，可以直接安排下一轮面试。",
        action: "schedule_interview",
        variant: "success",
      };
    }
  }

  if ((bestMatch?.score ?? -1) >= 85 && candidate.status === "interview") {
    return {
      label: "保持面试跟进",
      description: `最佳匹配 ${bestMatch?.jobTitle || "目标职位"} 表现稳定，建议继续推进当前流程。`,
      action: "maintain",
      variant: "success",
    };
  }

  return {
    label: "保持跟进",
    description: "匹配结果稳定，可以继续推进当前流程。",
    action: "maintain",
    variant: "default",
  };
}

export function deriveCandidateWorkbenchData(candidate: Candidate, jobs: Job[], interviews: Interview[] = []): CandidateWorkbenchData {
  const progress = deriveCandidateMatchProgress(candidate, jobs);
  const systemTags = getCandidateSystemTags(candidate, progress, interviews);
  const manualTags = candidate.manualTags || candidate.tags || [];

  return {
    candidate,
    progress,
    bestMatch: getBestMatch(candidate.matchedJobs || []),
    systemTags,
    allTags: [...systemTags, ...manualTags],
    recommendedAction: getCandidateRecommendedAction(candidate, progress, interviews),
  };
}

function getCandidatePriority(item: CandidateWorkbenchData): number {
  if (item.progress.status === "needs_review") return 0;
  if ((item.bestMatch?.score ?? -1) >= 85 && ["screening", "interview"].includes(item.candidate.status)) return 1;
  if (item.progress.status === "matching") return 2;
  if (item.progress.status === "not_started") return 3;
  return 4;
}

export function sortCandidatesForWorkbench(items: CandidateWorkbenchData[]): CandidateWorkbenchData[] {
  return [...items].sort((left, right) => {
    const priorityDelta = getCandidatePriority(left) - getCandidatePriority(right);
    if (priorityDelta !== 0) return priorityDelta;

    const scoreDelta = (right.bestMatch?.score ?? -1) - (left.bestMatch?.score ?? -1);
    if (scoreDelta !== 0) return scoreDelta;

    return new Date(right.candidate.updatedAt).getTime() - new Date(left.candidate.updatedAt).getTime();
  });
}

export function deriveInterviewArchiveState(interview: Interview): InterviewArchiveState {
  const isArchived = !!interview.archived;
  const archiveSourceStatus = interview.archivedFromStatus;

  return {
    isArchived,
    canArchive: !isArchived && ["completed", "cancelled"].includes(interview.status),
    canRestore: isArchived && !!archiveSourceStatus,
    archiveSourceStatus,
  };
}
