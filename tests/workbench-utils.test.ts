import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveCandidateWorkbenchData,
  deriveInterviewArchiveState,
  sortCandidatesForWorkbench,
} from "../lib/workbench-utils.ts";
import type { Candidate, Interview, Job } from "../lib/types.ts";

const activeJobs: Job[] = [
  {
    id: "job-1",
    title: "高级后端工程师",
    level: "senior",
    department: "研发",
    description: { overview: "", responsibilities: [], requirements: [], benefits: [] },
    skills: ["Go", "SQL"],
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    id: "job-2",
    title: "平台工程师",
    level: "mid",
    department: "研发",
    description: { overview: "", responsibilities: [], requirements: [], benefits: [] },
    skills: ["Node.js", "React"],
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "candidate-1",
    name: "张三",
    contact: { email: "zhangsan@example.com" },
    resume: {
      filename: "resume.pdf",
      filepath: "/tmp/resume.pdf",
      parsedData: {
        experience: [],
        education: [],
        skills: ["Go", "Docker"],
        summary: "后端工程师",
      },
    },
    matchedJobs: [],
    status: "pending",
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeInterview(overrides: Partial<Interview> = {}): Interview {
  return {
    id: "interview-1",
    jobId: "job-1",
    candidateId: "candidate-1",
    candidateName: "张三",
    jobTitle: "高级后端工程师",
    scheduledTime: new Date("2026-03-01T10:00:00.000Z"),
    questions: [],
    status: "completed",
    createdAt: new Date("2026-03-01T09:00:00.000Z"),
    ...overrides,
  };
}

test("deriveCandidateWorkbenchData marks unmatched candidates as not started with a follow-up recommendation", () => {
  const result = deriveCandidateWorkbenchData(makeCandidate(), activeJobs);

  assert.equal(result.progress.status, "not_started");
  assert.equal(result.progress.matchedJobCount, 0);
  assert.equal(result.progress.totalJobCount, 2);
  assert.match(result.recommendedAction.label, /开始匹配|执行匹配/);
  assert.ok(result.systemTags.includes("未匹配"));
});

test("deriveCandidateWorkbenchData marks missing active job coverage as needs review", () => {
  const candidate = makeCandidate({
    matchedJobs: [
      {
        jobId: "job-1",
        jobTitle: "高级后端工程师",
        score: 88,
        reason: "非常匹配",
        assessedAt: new Date("2026-03-10T10:00:00.000Z"),
      },
    ],
  });

  const result = deriveCandidateWorkbenchData(candidate, activeJobs);

  assert.equal(result.progress.status, "needs_review");
  assert.equal(result.progress.needsReview, true);
  assert.ok(result.systemTags.includes("待复核"));
  assert.equal(result.recommendedAction.variant, "warning");
});

test("deriveCandidateWorkbenchData promotes high-match interview candidates with mixed tags", () => {
  const candidate = makeCandidate({
    status: "interview",
    manualTags: ["重点跟进"],
    matchedJobs: [
      {
        jobId: "job-1",
        jobTitle: "高级后端工程师",
        score: 92,
        reason: "岗位高度匹配",
        pros: ["Go 经验扎实"],
        cons: ["缺少大型团队经验"],
        assessedAt: new Date("2026-03-10T10:00:00.000Z"),
      },
      {
        jobId: "job-2",
        jobTitle: "平台工程师",
        score: 81,
        reason: "具备迁移潜力",
        assessedAt: new Date("2026-03-10T10:00:00.000Z"),
      },
    ],
  });

  const result = deriveCandidateWorkbenchData(candidate, activeJobs);

  assert.equal(result.progress.status, "completed");
  assert.equal(result.bestMatch?.jobId, "job-1");
  assert.ok(result.systemTags.includes("高匹配"));
  assert.ok(result.systemTags.includes("多岗位可投"));
  assert.ok(result.allTags.includes("重点跟进"));
  assert.equal(result.recommendedAction.variant, "success");
});

test("deriveCandidateWorkbenchData still allows archived interview candidates to continue the process", () => {
  const candidate = makeCandidate({
    status: "interview",
    matchedJobs: [
      {
        jobId: "job-1",
        jobTitle: "高级后端工程师",
        score: 90,
        reason: "高度匹配",
        assessedAt: new Date("2026-03-10T10:00:00.000Z"),
      },
      {
        jobId: "job-2",
        jobTitle: "平台工程师",
        score: 79,
        reason: "可作为备选",
        assessedAt: new Date("2026-03-10T10:00:00.000Z"),
      },
    ],
  });

  const archivedInterview = makeInterview({
    candidateId: candidate.id,
    archived: true,
    archivedAt: new Date("2026-03-12T10:00:00.000Z"),
    archivedFromStatus: "completed",
  });

  const result = deriveCandidateWorkbenchData(candidate, activeJobs, [archivedInterview]);

  assert.ok(result.systemTags.includes("待安排面试"));
  assert.equal(result.recommendedAction.label, "安排下一轮面试");
  assert.equal(result.recommendedAction.action, "schedule_interview");
});

test("sortCandidatesForWorkbench prioritizes needs review before high-match follow-up candidates", () => {
  const needsReview = deriveCandidateWorkbenchData(
    makeCandidate({
      id: "candidate-review",
      name: "需复核候选人",
      matchedJobs: [{ jobId: "job-1", score: 75, reason: "待补齐", assessedAt: new Date("2026-03-11T10:00:00.000Z") }],
    }),
    activeJobs,
  );
  const highMatch = deriveCandidateWorkbenchData(
    makeCandidate({
      id: "candidate-high",
      name: "高匹配候选人",
      status: "screening",
      matchedJobs: [
        { jobId: "job-1", score: 91, reason: "匹配度高", assessedAt: new Date("2026-03-12T10:00:00.000Z") },
        { jobId: "job-2", score: 80, reason: "也匹配", assessedAt: new Date("2026-03-12T10:00:00.000Z") },
      ],
    }),
    activeJobs,
  );

  const sorted = sortCandidatesForWorkbench([highMatch, needsReview]);

  assert.deepEqual(
    sorted.map((item) => item.candidate.id),
    ["candidate-review", "candidate-high"],
  );
});

test("deriveInterviewArchiveState allows archive for completed interviews and restore archived interviews", () => {
  const completed = deriveInterviewArchiveState(makeInterview());
  const archived = deriveInterviewArchiveState(
    makeInterview({
      archived: true,
      archivedAt: new Date("2026-03-11T10:00:00.000Z"),
      archivedFromStatus: "completed",
    }),
  );
  const scheduled = deriveInterviewArchiveState(
    makeInterview({
      status: "scheduled",
    }),
  );

  assert.equal(completed.canArchive, true);
  assert.equal(completed.canRestore, false);
  assert.equal(archived.canArchive, false);
  assert.equal(archived.canRestore, true);
  assert.equal(scheduled.canArchive, false);
});
