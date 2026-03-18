// ==================== Job Types ====================

export interface Job {
  id: string;
  title: string;
  level: "junior" | "mid" | "senior" | "expert";
  department: string;
  description: JobDescription;
  skills: string[];
  salary?: SalaryRange;
  status: "active" | "closed" | "draft" | "paused";
  headcount?: number;
  hired_count?: number;
  priority?: "low" | "medium" | "high";
  tags?: string[];
  scoringRule?: ScoringRule;
  scoringRuleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobDescription {
  overview: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
}

export interface SalaryRange {
  min: number;
  max: number;
  currency: string;
}

// ==================== Candidate Types ====================

export interface Candidate {
  id: string;
  name: string;
  contact: CandidateContact;
  resume: ResumeInfo;
  matchedJobs: JobMatch[];
  status: CandidateStatus;
  source?: string;
  notes?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CandidateContact {
  email: string;
  phone?: string;
  wechat?: string;
}

export interface ResumeInfo {
  filename: string;
  filepath: string;
  parsedData?: ParsedResumeData;
}

export interface ParsedResumeData {
  experience: WorkExperience[];
  education: Education[];
  skills: string[];
  summary?: string;
  projects?: ProjectExperience[];
  pros?: string[];
  cons?: string[];
}

export interface WorkExperience {
  company: string;
  position: string;
  duration: string;
  description: string;
  achievements?: string[];
}

export interface Education {
  school: string;
  degree: string;
  major: string;
  graduation?: string;
}

export interface ProjectExperience {
  name: string;
  role: string;
  duration?: string;
  description: string;
  technologies?: string[];
}

// ==================== Scoring Rule Types ====================

export interface ScoringEvaluator {
  method: "ai" | "keyword" | "duration" | "boolean" | "range";
  keywords?: string[];
  matchMode?: "any" | "all";
  minYears?: number;
  preferredYears?: number;
  aiPrompt?: string;
  minValue?: number;
  maxValue?: number;
  booleanField?: string;
}

export interface ScoringDimension {
  id: string;
  name: string;
  weight: number;
  description?: string;
  type: "skills" | "experience" | "education" | "projects" | "custom";
  evaluator: ScoringEvaluator;
}

export interface ScoringRule {
  id: string;
  name: string;
  description?: string;
  version: string;
  dimensions: ScoringDimension[];
  totalScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScoringRuleSnapshot {
  ruleId: string;
  ruleName: string;
  version: string;
  dimensions: ScoringDimension[];
  snapshotAt: Date;
}

export interface DimensionScore {
  dimensionId: string;
  dimensionName: string;
  score: number;
  maxScore: number;
  weight: number;
  weightedScore: number;
  details?: {
    matched?: string[];
    missing?: string[];
    notes?: string;
  };
}

export interface JobMatch {
  jobId: string;
  jobTitle?: string;
  score: number;
  reason: string;
  pros?: string[];
  cons?: string[];
  assessedAt?: Date;
  scoringSnapshot?: ScoringRuleSnapshot;
  dimensionScores?: DimensionScore[];
}

export type CandidateStatus =
  | "pending"
  | "screening"
  | "interview"
  | "offered"
  | "hired"
  | "rejected";

// ==================== Interview Types ====================

export interface Interview {
  id: string;
  jobId: string;
  candidateId: string;
  jobTitle?: string;
  candidateName?: string;
  scheduledTime: Date;
  duration?: number;
  type?: "onsite" | "online" | "phone";
  location?: string;
  interviewer?: string;
  questions: InterviewQuestion[];
  feedback?: InterviewFeedback;
  evaluationPreset?: EvaluationPreset;
  transcript?: string;
  status: InterviewStatus;
  createdAt: Date;
}

export interface InterviewQuestion {
  question: string;
  category: string;
  difficulty?: "easy" | "medium" | "hard";
  purpose?: string;
  expectedAnswer?: string;
  keyPoints?: AnswerKeyPoint[];
}

export interface AnswerKeyPoint {
  point: string;
  level: "basic" | "intermediate" | "advanced" | "expert";
  explanation: string;
}

export interface InterviewFeedback {
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore?: number;
  culturalFitScore?: number;
  overallScore: number;
  dimensionScores?: Record<string, number>;
  strengths?: string[];
  concerns?: string[];
  pros?: string[];
  cons?: string[];
  notes: string;
  recommendation: "strong_hire" | "hire" | "no_hire" | "strong_no_hire";
}

export interface EvaluationDimension {
  id: string;
  name: string;
  weight: number;
  description?: string;
}

export interface EvaluationPreset {
  id: string;
  name: string;
  dimensions: EvaluationDimension[];
}

export type InterviewStatus = "scheduled" | "completed" | "cancelled";

// ==================== Message & Conversation Types ====================

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  agentUsed?: string;
  toolsCalled?: string[];
  contextId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  context?: ConversationContext;
  archived?: boolean;
  favorite?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationContext {
  currentJob?: string;
  currentCandidate?: string;
  currentModule?: string;
  sessionId?: string;
}

// ==================== Template Types ====================

export interface CommunicationTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  subject?: string;
  content: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type TemplateCategory =
  | "interview_invitation"
  | "interview_feedback"
  | "offer"
  | "rejection"
  | "salary_negotiation"
  | "follow_up";

// ==================== UI State Types ====================

export type ModuleId =
  | "chat"
  | "jobs"
  | "scoring-rules"
  | "candidates"
  | "interviews"
  | "history"
  | "settings";

export interface UIState {
  currentModule: ModuleId;
  sidebarCollapsed: boolean;
  infoPanelVisible: boolean;
  selectedConversationId?: string;
  selectedJobId?: string;
  selectedCandidateId?: string;
  selectedInterviewId?: string;
}

// ==================== Filter & Search Types ====================

export interface JobFilters {
  department?: string;
  level?: string;
  status?: string;
  search?: string;
}

export interface CandidateFilters {
  status?: CandidateStatus;
  minMatchScore?: number;
  search?: string;
}

export interface InterviewFilters {
  status?: InterviewStatus;
  dateFrom?: Date;
  dateTo?: Date;
  interviewer?: string;
}

// ==================== API Request/Response Types ====================

export interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: ConversationContext;
}

export interface ChatResponse {
  message: string;
  conversationId: string;
  metadata?: MessageMetadata;
}

export interface GenerateJDRequest {
  title: string;
  level: string;
  department: string;
  skills?: string[];
  requirements?: string[];
}

export interface ResumeUploadRequest {
  file: File;
  jobId?: string;
}

export interface ScheduleInterviewRequest {
  jobId: string;
  candidateId: string;
  scheduledTime: Date;
  location: string;
  interviewer: string;
}

// ==================== Error Types ====================

export interface AppError {
  code: string;
  message: string;
  details?: unknown;
}

export type ErrorCode =
  | "AGENT_ERROR"
  | "STORAGE_ERROR"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

// ==================== Action Types ====================

export type ChatActionType =
  | "create_job"
  | "create_candidate"
  | "match_candidate"
  | "schedule_interview"
  | "update_status";

export interface ChatAction {
  type: ChatActionType;
  data: Record<string, any>;
}

// ==================== Background Task Types ====================

export interface BackgroundTask {
  id: string;
  type: "analyze_resume" | "generate_jd" | "batch_match" | "batch_analyze";
  status: "pending" | "processing" | "completed" | "failed";
  input: any;
  result?: any;
  error?: string;
  progress?: number;
  createdAt: Date;
  completedAt?: Date;
}

// ==================== Notification Types ====================

export interface NotifyConfig {
  feishuWebhookUrl?: string;
  enabled: boolean;
  events: string[];
}

export type NotifyEvent =
  | "resume_analyzed"
  | "jd_generated"
  | "interview_scheduled"
  | "feedback_submitted"
  | "status_changed";
