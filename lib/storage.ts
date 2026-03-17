import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type {
  Job,
  Candidate,
  Interview,
  Conversation,
  CommunicationTemplate,
  BackgroundTask,
} from "@/lib/types";

// ==================== Database Configuration ====================

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "hr-assistant.db");

let dbInstance: Database.Database | null = null;

function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  dbInstance = new Database(DB_PATH);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");

  initializeTables(dbInstance);
  migrateFromFiles(dbInstance);

  return dbInstance;
}

function initializeTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'mid',
      department TEXT NOT NULL,
      description TEXT DEFAULT '{}',
      skills TEXT DEFAULT '[]',
      salary TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      headcount INTEGER,
      hired_count INTEGER DEFAULT 0,
      priority TEXT,
      tags TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      wechat TEXT DEFAULT '',
      resume_filename TEXT DEFAULT '',
      resume_filepath TEXT DEFAULT '',
      resume_parsed_data TEXT DEFAULT '{}',
      resume_raw_text TEXT DEFAULT '',
      matched_jobs TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      source TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS interviews (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      job_title TEXT DEFAULT '',
      candidate_name TEXT DEFAULT '',
      scheduled_time TEXT NOT NULL,
      duration INTEGER DEFAULT 60,
      location TEXT DEFAULT '',
      type TEXT DEFAULT 'onsite',
      interviewer TEXT DEFAULT '',
      questions TEXT DEFAULT '[]',
      feedback TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      messages TEXT DEFAULT '[]',
      context TEXT,
      archived INTEGER DEFAULT 0,
      favorite INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      subject TEXT DEFAULT '',
      content TEXT DEFAULT '',
      variables TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      input TEXT DEFAULT '{}',
      result TEXT,
      error TEXT,
      progress INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

// ==================== JSON File Migration ====================

function migrateFromFiles(db: Database.Database): void {
  const jobCount = (db.prepare("SELECT COUNT(*) as cnt FROM jobs").get() as any).cnt;
  if (jobCount > 0) return;

  const subdirs = ["jobs", "candidates", "interviews", "conversations", "templates"];
  let hasFiles = false;
  for (const sub of subdirs) {
    const dir = path.join(DATA_DIR, sub);
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
      if (files.length > 0) {
        hasFiles = true;
        break;
      }
    }
  }
  if (!hasFiles) return;

  console.log("[Migration] Migrating JSON files to SQLite...");

  const migrateAll = db.transaction(() => {
    // Jobs
    const jobsDir = path.join(DATA_DIR, "jobs");
    if (fs.existsSync(jobsDir)) {
      for (const file of fs.readdirSync(jobsDir).filter((f) => f.endsWith(".json"))) {
        try {
          const raw = JSON.parse(fs.readFileSync(path.join(jobsDir, file), "utf-8"));
          insertJobRow(db, raw);
        } catch (e) {
          console.error(`[Migration] Failed to migrate job ${file}:`, e);
        }
      }
    }

    // Candidates
    const candDir = path.join(DATA_DIR, "candidates");
    if (fs.existsSync(candDir)) {
      for (const file of fs.readdirSync(candDir).filter((f) => f.endsWith(".json"))) {
        try {
          const raw = JSON.parse(fs.readFileSync(path.join(candDir, file), "utf-8"));
          insertCandidateRow(db, raw);
        } catch (e) {
          console.error(`[Migration] Failed to migrate candidate ${file}:`, e);
        }
      }
    }

    // Interviews
    const intDir = path.join(DATA_DIR, "interviews");
    if (fs.existsSync(intDir)) {
      for (const file of fs.readdirSync(intDir).filter((f) => f.endsWith(".json"))) {
        try {
          const raw = JSON.parse(fs.readFileSync(path.join(intDir, file), "utf-8"));
          insertInterviewRow(db, raw);
        } catch (e) {
          console.error(`[Migration] Failed to migrate interview ${file}:`, e);
        }
      }
    }

    // Conversations
    const convDir = path.join(DATA_DIR, "conversations");
    if (fs.existsSync(convDir)) {
      for (const file of fs.readdirSync(convDir).filter((f) => f.endsWith(".json"))) {
        try {
          const raw = JSON.parse(fs.readFileSync(path.join(convDir, file), "utf-8"));
          insertConversationRow(db, raw);
        } catch (e) {
          console.error(`[Migration] Failed to migrate conversation ${file}:`, e);
        }
      }
    }

    // Templates
    const tmplDir = path.join(DATA_DIR, "templates");
    if (fs.existsSync(tmplDir)) {
      for (const file of fs.readdirSync(tmplDir).filter((f) => f.endsWith(".json"))) {
        try {
          const raw = JSON.parse(fs.readFileSync(path.join(tmplDir, file), "utf-8"));
          insertTemplateRow(db, raw);
        } catch (e) {
          console.error(`[Migration] Failed to migrate template ${file}:`, e);
        }
      }
    }
  });

  migrateAll();
  console.log("[Migration] Migration complete.");
}

// ==================== Row Insert Helpers ====================

function insertJobRow(db: Database.Database, raw: any): void {
  db.prepare(`
    INSERT OR IGNORE INTO jobs (id, title, level, department, description, skills, salary, status, headcount, hired_count, priority, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    raw.id,
    raw.title,
    raw.level || "mid",
    raw.department,
    JSON.stringify(raw.description || {}),
    JSON.stringify(raw.skills || []),
    raw.salary ? JSON.stringify(raw.salary) : null,
    raw.status || "draft",
    raw.headcount || null,
    raw.hired_count || 0,
    raw.priority || null,
    JSON.stringify(raw.tags || []),
    raw.createdAt || new Date().toISOString(),
    raw.updatedAt || new Date().toISOString()
  );
}

function insertCandidateRow(db: Database.Database, raw: any): void {
  db.prepare(`
    INSERT OR IGNORE INTO candidates (id, name, email, phone, wechat, resume_filename, resume_filepath, resume_parsed_data, resume_raw_text, matched_jobs, status, source, notes, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    raw.id,
    raw.name || "未命名候选人",
    raw.contact?.email || raw.email || "",
    raw.contact?.phone || raw.phone || "",
    raw.contact?.wechat || raw.wechat || "",
    raw.resume?.filename || "",
    raw.resume?.filepath || "",
    JSON.stringify(raw.resume?.parsedData || {}),
    raw.resumeRawText || "",
    JSON.stringify(raw.matchedJobs || []),
    raw.status || "pending",
    raw.source || "",
    raw.notes || "",
    JSON.stringify(raw.tags || []),
    raw.createdAt || new Date().toISOString(),
    raw.updatedAt || new Date().toISOString()
  );
}

function insertInterviewRow(db: Database.Database, raw: any): void {
  db.prepare(`
    INSERT OR IGNORE INTO interviews (id, job_id, candidate_id, job_title, candidate_name, scheduled_time, duration, location, type, interviewer, questions, feedback, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    raw.id,
    raw.jobId,
    raw.candidateId,
    raw.jobTitle || "",
    raw.candidateName || "",
    raw.scheduledTime || new Date().toISOString(),
    raw.duration || 60,
    raw.location || "",
    raw.type || "onsite",
    raw.interviewer || "",
    JSON.stringify(raw.questions || []),
    raw.feedback ? JSON.stringify(raw.feedback) : null,
    raw.status || "scheduled",
    raw.createdAt || new Date().toISOString()
  );
}

function insertConversationRow(db: Database.Database, raw: any): void {
  db.prepare(`
    INSERT OR IGNORE INTO conversations (id, title, messages, context, archived, favorite, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    raw.id,
    raw.title || "",
    JSON.stringify(raw.messages || []),
    raw.context ? JSON.stringify(raw.context) : null,
    raw.archived ? 1 : 0,
    raw.favorite ? 1 : 0,
    raw.createdAt || new Date().toISOString(),
    raw.updatedAt || new Date().toISOString()
  );
}

function insertTemplateRow(db: Database.Database, raw: any): void {
  db.prepare(`
    INSERT OR IGNORE INTO templates (id, name, category, subject, content, variables, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    raw.id,
    raw.name,
    raw.category,
    raw.subject || "",
    raw.content || "",
    JSON.stringify(raw.variables || []),
    raw.createdAt || new Date().toISOString(),
    raw.updatedAt || new Date().toISOString()
  );
}

// ==================== Row → Object Mappers ====================

function rowToJob(row: any): Job {
  return {
    id: row.id,
    title: row.title,
    level: row.level,
    department: row.department,
    description: safeJsonParse(row.description, { overview: "", responsibilities: [], requirements: [], benefits: [] }),
    skills: safeJsonParse(row.skills, []),
    salary: row.salary ? safeJsonParse(row.salary, undefined) : undefined,
    status: row.status,
    headcount: row.headcount ?? undefined,
    hired_count: row.hired_count ?? undefined,
    priority: row.priority ?? undefined,
    tags: safeJsonParse(row.tags, []),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToCandidate(row: any): Candidate {
  return {
    id: row.id,
    name: row.name,
    contact: {
      email: row.email || "",
      phone: row.phone || undefined,
      wechat: row.wechat || undefined,
    },
    resume: {
      filename: row.resume_filename || "",
      filepath: row.resume_filepath || "",
      parsedData: safeJsonParse(row.resume_parsed_data, undefined),
    },
    matchedJobs: safeJsonParse(row.matched_jobs, []),
    status: row.status,
    source: row.source || undefined,
    notes: row.notes || undefined,
    tags: safeJsonParse(row.tags, []),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToInterview(row: any): Interview {
  return {
    id: row.id,
    jobId: row.job_id,
    candidateId: row.candidate_id,
    jobTitle: row.job_title || undefined,
    candidateName: row.candidate_name || undefined,
    scheduledTime: new Date(row.scheduled_time),
    duration: row.duration ?? undefined,
    location: row.location,
    type: row.type || undefined,
    interviewer: row.interviewer,
    questions: safeJsonParse(row.questions, []),
    feedback: row.feedback ? safeJsonParse(row.feedback, undefined) : undefined,
    status: row.status,
    createdAt: new Date(row.created_at),
  };
}

function rowToConversation(row: any): Conversation {
  return {
    id: row.id,
    title: row.title,
    messages: safeJsonParse(row.messages, []),
    context: row.context ? safeJsonParse(row.context, undefined) : undefined,
    archived: !!row.archived,
    favorite: !!row.favorite,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToTemplate(row: any): CommunicationTemplate {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    subject: row.subject || undefined,
    content: row.content,
    variables: safeJsonParse(row.variables, []),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function safeJsonParse<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    const parsed = JSON.parse(str);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

// ==================== Job Storage ====================

export function saveJob(job: Job): boolean {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO jobs (id, title, level, department, description, skills, salary, status, headcount, hired_count, priority, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, level=excluded.level, department=excluded.department,
        description=excluded.description, skills=excluded.skills, salary=excluded.salary,
        status=excluded.status, headcount=excluded.headcount, hired_count=excluded.hired_count,
        priority=excluded.priority, tags=excluded.tags, updated_at=excluded.updated_at
    `).run(
      job.id,
      job.title,
      job.level || "mid",
      job.department,
      JSON.stringify(job.description || {}),
      JSON.stringify(job.skills || []),
      job.salary ? JSON.stringify(job.salary) : null,
      job.status || "draft",
      job.headcount ?? null,
      job.hired_count ?? 0,
      job.priority ?? null,
      JSON.stringify(job.tags || []),
      new Date(job.createdAt).toISOString(),
      now
    );
    return true;
  } catch (error) {
    console.error("Error saving job:", error);
    return false;
  }
}

export function loadJob(jobId: string): Job | null {
  try {
    const db = getDb();
    const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
    return row ? rowToJob(row) : null;
  } catch (error) {
    console.error("Error loading job:", error);
    return null;
  }
}

export function loadAllJobs(): Job[] {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM jobs ORDER BY created_at DESC").all();
    return rows.map(rowToJob);
  } catch (error) {
    console.error("Error loading jobs:", error);
    return [];
  }
}

export function deleteJob(jobId: string): boolean {
  try {
    const db = getDb();
    const result = db.prepare("DELETE FROM jobs WHERE id = ?").run(jobId);
    return result.changes > 0;
  } catch (error) {
    console.error("Error deleting job:", error);
    return false;
  }
}

// ==================== Candidate Storage ====================

export function saveCandidate(candidate: Candidate): boolean {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO candidates (id, name, email, phone, wechat, resume_filename, resume_filepath, resume_parsed_data, matched_jobs, status, source, notes, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, email=excluded.email, phone=excluded.phone, wechat=excluded.wechat,
        resume_filename=excluded.resume_filename, resume_filepath=excluded.resume_filepath,
        resume_parsed_data=excluded.resume_parsed_data,
        matched_jobs=excluded.matched_jobs, status=excluded.status,
        source=excluded.source, notes=excluded.notes, tags=excluded.tags, updated_at=excluded.updated_at
    `).run(
      candidate.id,
      candidate.name,
      candidate.contact.email || "",
      candidate.contact.phone || "",
      candidate.contact.wechat || "",
      candidate.resume.filename || "",
      candidate.resume.filepath || "",
      JSON.stringify(candidate.resume.parsedData || {}),
      JSON.stringify(candidate.matchedJobs || []),
      candidate.status || "pending",
      candidate.source || "",
      candidate.notes || "",
      JSON.stringify(candidate.tags || []),
      new Date(candidate.createdAt).toISOString(),
      now
    );
    return true;
  } catch (error) {
    console.error("Error saving candidate:", error);
    return false;
  }
}

export function loadCandidate(candidateId: string): Candidate | null {
  try {
    const db = getDb();
    const row = db.prepare("SELECT * FROM candidates WHERE id = ?").get(candidateId);
    return row ? rowToCandidate(row) : null;
  } catch (error) {
    console.error("Error loading candidate:", error);
    return null;
  }
}

export function loadAllCandidates(): Candidate[] {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM candidates ORDER BY created_at DESC").all();
    return rows.map(rowToCandidate);
  } catch (error) {
    console.error("Error loading candidates:", error);
    return [];
  }
}

export function deleteCandidate(candidateId: string): boolean {
  try {
    const db = getDb();
    const result = db.prepare("DELETE FROM candidates WHERE id = ?").run(candidateId);
    return result.changes > 0;
  } catch (error) {
    console.error("Error deleting candidate:", error);
    return false;
  }
}

// ==================== Resume Raw Text ====================

export function saveRawResumeText(candidateId: string, text: string): boolean {
  try {
    const db = getDb();
    db.prepare("UPDATE candidates SET resume_raw_text = ? WHERE id = ?").run(text, candidateId);
    return true;
  } catch (error) {
    console.error("Error saving raw resume text:", error);
    return false;
  }
}

export function loadRawResumeText(candidateId: string): string {
  try {
    const db = getDb();
    const row = db.prepare("SELECT resume_raw_text FROM candidates WHERE id = ?").get(candidateId) as any;
    return row?.resume_raw_text || "";
  } catch (error) {
    console.error("Error loading raw resume text:", error);
    return "";
  }
}

// ==================== Interview Storage ====================

export function saveInterview(interview: Interview): boolean {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO interviews (id, job_id, candidate_id, job_title, candidate_name, scheduled_time, duration, location, type, interviewer, questions, feedback, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        job_id=excluded.job_id, candidate_id=excluded.candidate_id,
        job_title=excluded.job_title, candidate_name=excluded.candidate_name,
        scheduled_time=excluded.scheduled_time, duration=excluded.duration,
        location=excluded.location, type=excluded.type, interviewer=excluded.interviewer,
        questions=excluded.questions, feedback=excluded.feedback, status=excluded.status
    `).run(
      interview.id,
      interview.jobId,
      interview.candidateId,
      interview.jobTitle || "",
      interview.candidateName || "",
      new Date(interview.scheduledTime).toISOString(),
      interview.duration ?? 60,
      interview.location || "",
      interview.type || "onsite",
      interview.interviewer || "",
      JSON.stringify(interview.questions || []),
      interview.feedback ? JSON.stringify(interview.feedback) : null,
      interview.status || "scheduled",
      new Date(interview.createdAt).toISOString()
    );
    return true;
  } catch (error) {
    console.error("Error saving interview:", error);
    return false;
  }
}

export function loadInterview(interviewId: string): Interview | null {
  try {
    const db = getDb();
    const row = db.prepare("SELECT * FROM interviews WHERE id = ?").get(interviewId);
    return row ? rowToInterview(row) : null;
  } catch (error) {
    console.error("Error loading interview:", error);
    return null;
  }
}

export function loadAllInterviews(): Interview[] {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM interviews ORDER BY scheduled_time ASC").all();
    return rows.map(rowToInterview);
  } catch (error) {
    console.error("Error loading interviews:", error);
    return [];
  }
}

export function deleteInterview(interviewId: string): boolean {
  try {
    const db = getDb();
    const result = db.prepare("DELETE FROM interviews WHERE id = ?").run(interviewId);
    return result.changes > 0;
  } catch (error) {
    console.error("Error deleting interview:", error);
    return false;
  }
}

// ==================== Conversation Storage ====================

export function saveConversation(conversation: Conversation): boolean {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO conversations (id, title, messages, context, archived, favorite, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, messages=excluded.messages, context=excluded.context,
        archived=excluded.archived, favorite=excluded.favorite, updated_at=excluded.updated_at
    `).run(
      conversation.id,
      conversation.title || "",
      JSON.stringify(conversation.messages || []),
      conversation.context ? JSON.stringify(conversation.context) : null,
      conversation.archived ? 1 : 0,
      conversation.favorite ? 1 : 0,
      new Date(conversation.createdAt).toISOString(),
      now
    );
    return true;
  } catch (error) {
    console.error("Error saving conversation:", error);
    return false;
  }
}

export function loadConversation(conversationId: string): Conversation | null {
  try {
    const db = getDb();
    const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(conversationId);
    return row ? rowToConversation(row) : null;
  } catch (error) {
    console.error("Error loading conversation:", error);
    return null;
  }
}

export function loadAllConversations(): Conversation[] {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM conversations ORDER BY updated_at DESC").all();
    return rows.map(rowToConversation);
  } catch (error) {
    console.error("Error loading conversations:", error);
    return [];
  }
}

export function deleteConversation(conversationId: string): boolean {
  try {
    const db = getDb();
    const result = db.prepare("DELETE FROM conversations WHERE id = ?").run(conversationId);
    return result.changes > 0;
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return false;
  }
}

// ==================== Template Storage ====================

export function saveTemplate(template: CommunicationTemplate): boolean {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO templates (id, name, category, subject, content, variables, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, category=excluded.category, subject=excluded.subject,
        content=excluded.content, variables=excluded.variables, updated_at=excluded.updated_at
    `).run(
      template.id,
      template.name,
      template.category,
      template.subject || "",
      template.content || "",
      JSON.stringify(template.variables || []),
      new Date(template.createdAt).toISOString(),
      now
    );
    return true;
  } catch (error) {
    console.error("Error saving template:", error);
    return false;
  }
}

export function loadTemplate(templateId: string): CommunicationTemplate | null {
  try {
    const db = getDb();
    const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(templateId);
    return row ? rowToTemplate(row) : null;
  } catch (error) {
    console.error("Error loading template:", error);
    return null;
  }
}

export function loadAllTemplates(): CommunicationTemplate[] {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM templates ORDER BY created_at DESC").all();
    return rows.map(rowToTemplate);
  } catch (error) {
    console.error("Error loading templates:", error);
    return [];
  }
}

export function deleteTemplate(templateId: string): boolean {
  try {
    const db = getDb();
    const result = db.prepare("DELETE FROM templates WHERE id = ?").run(templateId);
    return result.changes > 0;
  } catch (error) {
    console.error("Error deleting template:", error);
    return false;
  }
}

// ==================== Data Management ====================

export function clearAllData(): boolean {
  try {
    const db = getDb();
    db.exec("DELETE FROM jobs; DELETE FROM candidates; DELETE FROM interviews; DELETE FROM conversations; DELETE FROM templates;");
    return true;
  } catch (error) {
    console.error("Error clearing data:", error);
    return false;
  }
}

export function getDataStats(): { jobs: number; candidates: number; interviews: number; conversations: number; templates: number } {
  try {
    const db = getDb();
    return {
      jobs: (db.prepare("SELECT COUNT(*) as cnt FROM jobs").get() as any).cnt,
      candidates: (db.prepare("SELECT COUNT(*) as cnt FROM candidates").get() as any).cnt,
      interviews: (db.prepare("SELECT COUNT(*) as cnt FROM interviews").get() as any).cnt,
      conversations: (db.prepare("SELECT COUNT(*) as cnt FROM conversations").get() as any).cnt,
      templates: (db.prepare("SELECT COUNT(*) as cnt FROM templates").get() as any).cnt,
    };
  } catch (error) {
    console.error("Error getting stats:", error);
    return { jobs: 0, candidates: 0, interviews: 0, conversations: 0, templates: 0 };
  }
}

// ==================== Utility Functions ====================

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Legacy compat: some code may call initializeDataDirectory
export function initializeDataDirectory(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const resumeDir = path.join(DATA_DIR, "resumes");
  if (!fs.existsSync(resumeDir)) {
    fs.mkdirSync(resumeDir, { recursive: true });
  }
}

// ==================== Task Storage ====================

export function saveTask(task: { id: string; type: string; status: string; input: any; result?: any; error?: string; progress?: number; createdAt: Date; completedAt?: Date }): boolean {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO tasks (id, type, status, input, result, error, progress, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status=excluded.status, result=excluded.result, error=excluded.error,
        progress=excluded.progress, completed_at=excluded.completed_at
    `).run(
      task.id, task.type, task.status,
      JSON.stringify(task.input || {}),
      task.result ? JSON.stringify(task.result) : null,
      task.error || null,
      task.progress ?? 0,
      new Date(task.createdAt).toISOString(),
      task.completedAt ? new Date(task.completedAt).toISOString() : null
    );
    return true;
  } catch (error) {
    console.error("Error saving task:", error);
    return false;
  }
}

export function loadTask(taskId: string): BackgroundTask | null {
  try {
    const db = getDb();
    const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as any;
    if (!row) return null;
    return {
      id: row.id, type: row.type, status: row.status,
      input: safeJsonParse(row.input, {}),
      result: row.result ? safeJsonParse(row.result, null) : undefined,
      error: row.error || undefined,
      progress: row.progress ?? 0,
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    };
  } catch (error) {
    console.error("Error loading task:", error);
    return null;
  }
}

export function loadPendingTasks(): BackgroundTask[] {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM tasks WHERE status IN ('pending','processing') ORDER BY created_at ASC").all();
    return rows.map((row: any) => ({
      id: row.id, type: row.type, status: row.status,
      input: safeJsonParse(row.input, {}),
      result: row.result ? safeJsonParse(row.result, null) : undefined,
      error: row.error || undefined,
      progress: row.progress ?? 0,
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    }));
  } catch (error) {
    console.error("Error loading pending tasks:", error);
    return [];
  }
}

// ==================== Settings Storage ====================

export function saveSetting(key: string, value: string): boolean {
  try {
    const db = getDb();
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
    return true;
  } catch (error) {
    console.error("Error saving setting:", error);
    return false;
  }
}

export function loadSetting(key: string): string | null {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as any;
    return row?.value || null;
  } catch (error) {
    console.error("Error loading setting:", error);
    return null;
  }
}

export function loadAllSettings(): Record<string, string> {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM settings").all() as any[];
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  } catch (error) {
    console.error("Error loading settings:", error);
    return {};
  }
}
