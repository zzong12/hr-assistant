# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

```bash
# Development
npm run dev              # Start development server (Next.js)
npm run build            # Production build
npm start               # Start production server
npm run lint            # Run ESLint
npm run typecheck       # Run TypeScript type checking (tsc --noEmit)

# Environment setup
npm run check-env       # Validate environment variables before dev (runs automatically via predev)

# Database migration happens automatically on startup
# - JSON files in data/ are migrated to SQLite on first run
# - All data stored in data/hr-assistant.db
```

## Architecture Overview

This is an **AI-powered HR Assistant** built as a **multi-agent system** using Claude API. The application is a full-stack Next.js app with a conversational UI for recruiting workflows.

### Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui components, Zustand (state management)
- **Backend**: Next.js API Routes, Anthropic Claude SDK (@anthropic-ai/sdk)
- **Database**: better-sqlite3 (embedded SQLite with WAL mode)
- **AI**: Multi-agent architecture with 5 specialized agents
- **Integrations**: Feishu (飞书) for bi-directional messaging

### Multi-Agent System

The core intelligence is provided by 5 specialized agents defined in [lib/agents.ts](lib/agents.ts):

1. **HR Concierge** ([`CONCIERGE_AGENT`](lib/agents.ts#L23)) - Main controller that routes tasks to appropriate specialist agents and integrates responses
2. **JD Generator** ([`JD_AGENT`](lib/agents.ts#L92)) - Writes job descriptions, suggests market salary ranges
3. **Resume Screener** ([`RESUME_AGENT`](lib/agents.ts#L142)) - Parses resumes, calculates match scores (0-100), provides pros/cons analysis
4. **Interview Coordinator** ([`INTERVIEW_AGENT`](lib/agents.ts#L218)) - Generates interview questions, designs evaluation frameworks
5. **Communication Specialist** ([`COMMUNICATION_AGENT`](lib/agents.ts#L315)) - Generates outreach templates (invitations, feedback, offers, rejections)

**Agent Selection**: The [`routeToAgent()`](lib/agents.ts#L468) function uses keyword matching to dispatch user messages to the appropriate agent.

**Action System**: Agents can embed `<!--ACTION:{"type":"...","data":{...}}-->` comments in responses to trigger data mutations (create_job, create_candidate, update_status, schedule_interview). See [Concierge agent prompt](lib/agents.ts#L56).

### Data Layer

**SQLite Database** ([lib/storage.ts](lib/storage.ts)):
- Single database file: `data/hr-assistant.db`
- Tables: jobs, candidates, interviews, conversations, templates, tasks, settings
- **Automatic migration**: Legacy JSON files in `data/{jobs,candidates,interviews,conversations,templates}/` are migrated to SQLite on startup
- All data persisted to `data/` directory (gitignored)

**Key Types** ([lib/types.ts](lib/types.ts)):
- `Job` - Position with level, department, description (overview/responsibilities/requirements/benefits), skills, salary range
- `Candidate` - Contact info, resume (parsed data with experience/education/skills/projects), matchedJobs array with scores
- `Interview` - Links job+candidate, questions with keyPoints (basic/intermediate/advanced/expert levels), feedback with dimensionScores
- `Conversation` - Messages array with context tracking, supports archiving/favoriting

### Application Structure

```
app/
├── (main)/              # Route group for main layout
│   ├── layout.tsx       # Main app layout with Sidebar + InfoPanel
│   ├── page.tsx         # Chat interface + data dashboard
│   ├── jobs/            # Job management
│   ├── candidates/      # Candidate management
│   ├── interviews/      # Interview scheduling & management
│   ├── history/         # Conversation history
│   └── settings/        # App configuration
├── api/                 # API routes
│   ├── chat/route.ts    # Streaming chat endpoint
│   ├── jobs/            # Job CRUD + JD generation
│   ├── candidates/      # Candidate CRUD + resume upload + matching
│   └── interviews/      # Interview CRUD + question generation
└── layout.tsx           # Root layout (theme provider)

components/
├── ChatInterface.tsx    # Main chat UI with streaming support
├── Sidebar.tsx          # Navigation sidebar
├── InfoPanel.tsx        # Contextual info panel (jobs/candidates/interviews)
├── VoiceAssistant.tsx   # Web Speech API integration
└── ui/                  # shadcn/ui components (Radix primitives)

lib/
├── agents.ts            # Agent definitions + AgentManager class
├── storage.ts           # SQLite database operations
├── types.ts             # All TypeScript type definitions
├── env.ts               # Environment variable validation
├── feishu.ts            # Feishu integration (message reply, file download)
├── api-client.ts        # Frontend API client
├── *-utils.ts           # Domain-specific utilities (jd, resume, interview, communication, conversation, performance)
└── notify.ts            # Notification service (Feishu webhooks)

store/
└── useStore.ts          # Zustand store with persistence (conversations, jobs, candidates, interviews, templates, UI state)
```

### State Management

**Zustand** ([store/useStore.ts](store/useStore.ts)) with persistence middleware:
- Manages: conversations, jobs, candidates, interviews, templates, UI state (currentModule, sidebarCollapsed, selections)
- Persisted to localStorage with partial state (conversations, currentModule, isSidebarCollapsed)
- Includes selectors for filtered queries (by status, etc.)

## Key Patterns & Conventions

### Agent Response Format

Agents return structured responses with:
- `content`: The response text (may contain ACTION directives)
- `agentUsed`: Which agent handled the request
- `metadata`: model used, token usage, etc.

The concierge agent can issue **action directives** that trigger data mutations:
```
<!--ACTION:{"type":"create_job","data":{"title":"Senior Go Engineer","department":"Engineering","level":"senior","skills":["Go","Docker","K8s"],"status":"active"}}-->
```

Supported actions: `create_job`, `create_candidate`, `update_status`, `schedule_interview`

### Resume Processing

1. Upload via `/api/candidates/upload` (multipart/form-data)
2. Parse PDF with `pdf-parse`
3. Extract structured data via Resume Screener agent
4. Calculate match scores against all active jobs
5. Store parsed data in `candidate.resume.parsedData`
6. Store raw resume text separately for re-analysis

### Match Scoring

**Resume Screener** evaluates candidates with a 100-point scale:
- Skills (40 points): Direct skill matching
- Experience (30 points): Relevance and depth
- Education (15 points): Degree and major alignment
- Projects (15 points): Quality and relevance

**Important**: All analyses must be **dual-sided** (pros + cons). Even strong candidates need identified risks/concerns.

### Interview Questions

Questions include `keyPoints` array with分级评估:
```typescript
{
  point: "Understanding of closures",
  level: "intermediate",
  explanation: "Can explain closures and use them appropriately"
}
```

Levels: `basic` | `intermediate` | `advanced` | `expert`

### Feishu Integration

- Environment: `FEISHU_APP_ID`, `FEISHU_APP_SECRET`
- Webhook endpoint: `/api/feishu/webhook`
- Supports: text messages, file downloads (resumes), card replies
- Client lazy-loaded via dynamic import in [lib/feishu.ts](lib/feishu.ts)

### Streaming Responses

Chat API uses **Server-Sent Events** for streaming:
```typescript
// API route sends text chunks
for await (const chunk of stream) {
  // Send to client
}

// Client receives and renders incrementally
```

Implemented in [AgentManager.streamMessage()](lib/agents.ts#L574).

### Environment Variables

**Required**:
- `ANTHROPIC_API_KEY` - Claude API key (or compatible endpoint)

**Optional**:
- `ANTHROPIC_BASE_URL` - Custom API endpoint (e.g., for compatibility services)
- `DEFAULT_CLAUDE_MODEL` - Default model (default: claude-3-5-sonnet-20241022)
- `MAX_TOKENS` - Response token limit (default: 4096)
- `FEISHU_APP_ID`, `FEISHU_APP_SECRET` - For Feishu integration
- `DATA_DIR` - Data directory (default: ./data)

**Validation**: Run `npm run check-env` or see [lib/env.ts](lib/env.ts) for validation logic.

### Type Safety

- All types centralized in [lib/types.ts](lib/types.ts)
- Database rows mapped to TypeScript objects via `rowTo*()` functions in storage.ts
- Use `safeJsonParse<T>()` for optional JSON fields with fallback values

### API Patterns

- **Standard**: Use `NextResponse.json()` for responses
- **Streaming**: Use `ReadableStream` with `TextEncoder` for SSE
- **Error handling**: Return consistent error format `{ error: string, details?: any }`
- **Validation**: Validate request shapes against types from lib/types.ts

### UI Components

- All UI components from **shadcn/ui** (Radix UI primitives)
- Custom components: `ChatInterface`, `Sidebar`, `InfoPanel`, `VoiceAssistant`
- Styling: Tailwind CSS 4 with custom color scheme
- Icons: Lucide React

## Development Notes

### Adding a New Agent

1. Define agent config in [lib/agents.ts](lib/agents.ts)
2. Add routing logic in `routeToAgent()`
3. Update concierge prompt to mention when to use the new agent
4. Add corresponding API routes if needed
5. Update [lib/types.ts](lib/types.ts) for any new data structures

### Database Schema Changes

1. Modify `initializeTables()` in [lib/storage.ts](lib/storage.ts#L37)
2. Update corresponding `rowTo*()` mapper
3. Update `save*()` functions to handle new fields
4. Consider migration strategy for existing data

### Feishu Webhook Events

The webhook handler receives:
- Message events (user sends message/file)
- Needs to parse event type and route to appropriate handler
- Reply via `replyFeishuMessage()` or `replyFeishuCard()`

See [lib/feishu.ts](lib/feishu.ts) for helper functions.

## Important Constraints

- **Data locality**: All data stored locally in SQLite (`data/hr-assistant.db`)
- **No cloud sync**: No external database or cloud storage (except optional Feishu integration)
- **PDF parsing only**: Resume parsing limited to PDF format (via `pdf-parse`)
- **Chinese-language focused**: UI and prompts are in Chinese, designed for Chinese HR workflows
- **Single-user design**: No multi-tenancy or authentication (currently)
- **Desktop-first**: Optimized for desktop browser usage (mobile responsive but not primary)

## Testing & Deployment

- **Docker**: Use provided `Dockerfile` and `docker-compose.yml` for containerized deployment
- **Data persistence**: Mount `data/` volume in Docker to persist database
- **Port**: Default 3000, configurable via `PORT` env var
- **Health check**: Ensure `ANTHROPIC_API_KEY` is set before starting

See [README.md](README.md) and [docs/ENV_CONFIGURATION.md](docs/ENV_CONFIGURATION.md) for deployment details.
