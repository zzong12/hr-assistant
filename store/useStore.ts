import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Conversation,
  Message,
  Job,
  Candidate,
  Interview,
  ModuleId,
  UIState,
  CommunicationTemplate,
} from "@/lib/types";

interface AppState extends UIState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isLoadingConversation: boolean;
  jobs: Job[];
  currentJob: Job | null;
  candidates: Candidate[];
  currentCandidate: Candidate | null;
  interviews: Interview[];
  currentInterview: Interview | null;
  templates: CommunicationTemplate[];
  isSidebarCollapsed: boolean;
}

interface AppActions {
  // Conversation
  setCurrentConversation: (conversation: Conversation | null) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  addMessageToConversation: (conversationId: string, message: Message) => void;

  // Job
  setCurrentJob: (job: Job | null) => void;
  addJob: (job: Job) => void;
  updateJob: (id: string, updates: Partial<Job>) => void;
  deleteJob: (id: string) => void;
  setJobs: (jobs: Job[]) => void;

  // Candidate
  setCurrentCandidate: (candidate: Candidate | null) => void;
  addCandidate: (candidate: Candidate) => void;
  updateCandidate: (id: string, updates: Partial<Candidate>) => void;
  deleteCandidate: (id: string) => void;
  setCandidates: (candidates: Candidate[]) => void;

  // Interview
  setCurrentInterview: (interview: Interview | null) => void;
  addInterview: (interview: Interview) => void;
  updateInterview: (id: string, updates: Partial<Interview>) => void;
  deleteInterview: (id: string) => void;
  setInterviews: (interviews: Interview[]) => void;

  // Template
  setTemplates: (templates: CommunicationTemplate[]) => void;
  addTemplate: (template: CommunicationTemplate) => void;

  // UI
  setCurrentModule: (module: ModuleId) => void;
  toggleSidebar: () => void;
  setSelectedIds: (ids: Partial<UIState>) => void;
  resetCurrentSelections: () => void;
}

export const useStore = create<AppState & AppActions>()(
  persist(
    (set) => ({
      // Initial State
      currentModule: "chat",
      sidebarCollapsed: false,
      infoPanelVisible: true,
      isSidebarCollapsed: false,

      conversations: [],
      currentConversation: null,
      isLoadingConversation: false,

      jobs: [],
      currentJob: null,

      candidates: [],
      currentCandidate: null,

      interviews: [],
      currentInterview: null,

      templates: [],

      // Conversation Actions
      setCurrentConversation: (conversation) =>
        set({ currentConversation: conversation }),

      addConversation: (conversation) =>
        set((state) => ({
          conversations: [conversation, ...state.conversations],
        })),

      updateConversation: (id, updates) =>
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === id
              ? { ...conv, ...updates, updatedAt: new Date() }
              : conv
          ),
          currentConversation:
            state.currentConversation?.id === id
              ? {
                  ...state.currentConversation,
                  ...updates,
                  updatedAt: new Date(),
                }
              : state.currentConversation,
        })),

      deleteConversation: (id) =>
        set((state) => ({
          conversations: state.conversations.filter((conv) => conv.id !== id),
          currentConversation:
            state.currentConversation?.id === id
              ? null
              : state.currentConversation,
        })),

      addMessageToConversation: (conversationId, message) =>
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, message],
                  updatedAt: new Date(),
                }
              : conv
          ),
          currentConversation:
            state.currentConversation?.id === conversationId
              ? {
                  ...state.currentConversation,
                  messages: [...state.currentConversation.messages, message],
                  updatedAt: new Date(),
                }
              : state.currentConversation,
        })),

      // Job Actions
      setCurrentJob: (job) => set({ currentJob: job }),
      addJob: (job) =>
        set((state) => ({ jobs: [job, ...state.jobs] })),
      updateJob: (id, updates) =>
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === id
              ? { ...job, ...updates, updatedAt: new Date() }
              : job
          ),
          currentJob:
            state.currentJob?.id === id
              ? { ...state.currentJob, ...updates, updatedAt: new Date() }
              : state.currentJob,
        })),
      deleteJob: (id) =>
        set((state) => ({
          jobs: state.jobs.filter((job) => job.id !== id),
          currentJob: state.currentJob?.id === id ? null : state.currentJob,
        })),
      setJobs: (jobs) => set({ jobs }),

      // Candidate Actions
      setCurrentCandidate: (candidate) =>
        set({ currentCandidate: candidate }),
      addCandidate: (candidate) =>
        set((state) => ({
          candidates: [candidate, ...state.candidates],
        })),
      updateCandidate: (id, updates) =>
        set((state) => ({
          candidates: state.candidates.map((c) =>
            c.id === id
              ? { ...c, ...updates, updatedAt: new Date() }
              : c
          ),
          currentCandidate:
            state.currentCandidate?.id === id
              ? { ...state.currentCandidate, ...updates, updatedAt: new Date() }
              : state.currentCandidate,
        })),
      deleteCandidate: (id) =>
        set((state) => ({
          candidates: state.candidates.filter((c) => c.id !== id),
          currentCandidate:
            state.currentCandidate?.id === id
              ? null
              : state.currentCandidate,
        })),
      setCandidates: (candidates) => set({ candidates }),

      // Interview Actions
      setCurrentInterview: (interview) =>
        set({ currentInterview: interview }),
      addInterview: (interview) =>
        set((state) => ({
          interviews: [interview, ...state.interviews],
        })),
      updateInterview: (id, updates) =>
        set((state) => ({
          interviews: state.interviews.map((i) =>
            i.id === id ? { ...i, ...updates } : i
          ),
          currentInterview:
            state.currentInterview?.id === id
              ? { ...state.currentInterview, ...updates }
              : state.currentInterview,
        })),
      deleteInterview: (id) =>
        set((state) => ({
          interviews: state.interviews.filter((i) => i.id !== id),
          currentInterview:
            state.currentInterview?.id === id
              ? null
              : state.currentInterview,
        })),
      setInterviews: (interviews) => set({ interviews }),

      // Template Actions
      setTemplates: (templates) => set({ templates }),
      addTemplate: (template) =>
        set((state) => ({
          templates: [template, ...state.templates],
        })),

      // UI Actions
      setCurrentModule: (module) => set({ currentModule: module }),
      toggleSidebar: () =>
        set((state) => ({
          isSidebarCollapsed: !state.isSidebarCollapsed,
        })),
      setSelectedIds: (ids) => set((state) => ({ ...state, ...ids })),
      resetCurrentSelections: () =>
        set({
          currentConversation: null,
          currentJob: null,
          currentCandidate: null,
          currentInterview: null,
        }),
    }),
    {
      name: "hr-assistant-storage",
      partialize: (state) => ({
        conversations: state.conversations,
        currentModule: state.currentModule,
        isSidebarCollapsed: state.isSidebarCollapsed,
      }),
    }
  )
);

// Selectors
export const selectCurrentConversationMessages = (state: AppState) =>
  state.currentConversation?.messages || [];

export const selectJobsByStatus = (state: AppState, status: string) =>
  state.jobs.filter((job) => job.status === status);

export const selectCandidatesByStatus = (state: AppState, status: string) =>
  state.candidates.filter((candidate) => candidate.status === status);
