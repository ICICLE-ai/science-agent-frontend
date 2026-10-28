"use client"

import React from "react"
import { useState, useEffect, useRef } from "react"
import {
  FileCode,
  ArrowBigRight,
  Files,
  ChevronDown,
  SidebarClose,
  Settings,
  Zap,
  MessageSquare,
  Send,
  Info,
  FileText,
  BarChart,
  HelpCircle,
  AlertCircle,
  ArrowDown,
  Edit,
  ChevronUp,
  House,
  Trash2,
  Database,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { useDebouncedCallback } from "use-debounce"
import { Link } from "react-router-dom"
import { useTheme } from "@/providers/ThemeProvider"
import { ThemeToggle } from "@/components/ThemeToggleButton"
import {
  createAgentSession,
  validateAgentSession,
  AgentWebSocketConnection,
  uploadFile,
  deleteFile,
  deleteAgentSession,
  fetchAccountSession,
  fetchUserTasks,
  type AccountSession,
  type ExecutionLogEntry,
  type CodeFile,
  type OutputFile,
  type AgentSession,
  type AgentMessage,
  type AgentMessageWorkflowProgress,
} from "../api/api"
import { ThemeDropdown } from "@/components/ThemeDropdown"
import { Label } from "@/components/ui/label"
import { formatFileSize, scrollIntoView } from "@/lib/utils"
import { FileUploader, type UploadedFile } from "@/components/ui/file-uploader"
import MarkdownRenderer from "@/components/MarkdownRenderer"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { ResultsPanel } from "../components/panels/ResultsPanel"
import HelpModal from "../components/HelpModal"
import WorkflowStepsIndicator from "../components/WorkflowStepsIndicator"
import { CodeBlockRenderer } from "@/components/CodeBlockRenderer"
import { LocalStorageInput } from "@/components/ui/local-storage-input"
import { LocalStorageSwitch } from "@/components/ui/local-storage-switch"
import { CodeEditorPanel } from "@/components/panels/CodeEditorPanel"
import { ResizablePanels } from "../components/ResizablePanels"
import { TapisAccountControl } from "@/components/TapisAccountControl"
import { LiveWorkflowProgress } from "@/components/LiveWorkflowProgress"

type PanelType = "reasoning" | "program" | "results"

interface ReasoningItemBlock {
  type: "code" | "text"
  content: string
  name?: string
  completed: boolean
}

interface ReasoningItem {
  role: string
  items: ReasoningItemBlock[]
  tag: string
  id: string
}

const Execution = () => {
  const [useResizableTabs, setUseResizableTabs] = useState<boolean>(true)
  const [mainTab, setMainTab] = useState<PanelType>("reasoning")
  const [activePanel, setActivePanel] = useState<PanelType>("reasoning")
  const [activatedPanels, setActivatedPanels] = useState<PanelType[]>(["reasoning"])
  const [sidebarTab, setSidebarTab] = useState<"conversations" | "input" | "settings">("conversations")
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false)
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false)
  const [isDiffViewActive, setIsDiffViewActive] = useState<boolean>(false)
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [sidebarFilesDropdownOpen, setSidebarFilesDropdownOpen] = useState<boolean>(true)
  const [isInstructionEditable, setIsInstructionEditable] = useState<boolean>(true)
  const [currentStep, setCurrentStep] = useState<number>(1)
  const [userScrolledReasoning, setUserScrolledReasoning] = useState<boolean>(false)
  const [agentSession, setAgentSession] = useState<AgentSession>()
  const [domainKnowledge, setDomainKnowledge] = useState<string>("")
  const [description, setDescription] = useState<string>("")
  const [taskInst, setTaskInst] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [reasoningProcess, setReasoningProcess] = useState<ReasoningItem[]>([])
  const [codeFiles, setCodeFiles] = useState<CodeFile[]>([])
  const [selectedProgramIndex, setSelectedProgramIndex] = useState<number>(0)
  const [reasoningCounter, setReasoningCounter] = useState<number>(0)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [executionLog, setExecutionLog] = useState<ExecutionLogEntry[]>([])
  const [generationError, setGenerationError] = useState<string>("")
  const [outputFiles, setOutputFiles] = useState<OutputFile[]>([])
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [showLLMModal, setShowLLMModal] = useState<boolean>(false)
  const [isDeletingProject, setIsDeletingProject] = useState<boolean>(false)
  const [accountSession, setAccountSession] = useState<AccountSession>({ connected: false })
  const [isAccountLoading, setIsAccountLoading] = useState(true)
  const [userSessions, setUserSessions] = useState<AgentSession[]>([])
  const [workflowProgress, setWorkflowProgress] = useState<AgentMessageWorkflowProgress[]>([])

  const reasoningRef = useRef<HTMLDivElement>(null)
  const workflowRunId = useRef<string | null>(null)

  // Load resizable tabs preference from localStorage
  useEffect(() => {
    const savedPreference = localStorage.getItem("useResizableTabs")
    if (savedPreference !== null) {
      setUseResizableTabs(savedPreference === "true")
    }
  }, [])

  useEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => setIsTransitioning(false), 100)
      return () => clearTimeout(timer)
    }
  }, [isTransitioning])

  let msg: any = null
  let lastExecLog: ExecutionLogEntry = {
    start_time: 0,
    end_time: 0,
    command: [],
    output: "",
    exit_code: 0,
    tag: "",
  }

  const handleAgentMessage = (data: AgentMessage | null, err: unknown) => {
    if (err) {
      console.error("Generation error:", err)
      setIsGenerating(false)
      setIsRunning(false)
      setGenerationError(err instanceof Error ? err.message : String(err))
      return
    }

    if (!data) { return }

    switch (data.type) {
      case "state":
        initState(data.state)
        if (!data.has_default_llm) {
          const saved = localStorage.getItem("llm_engine_name")
          if (!saved) {
            setShowLLMModal(true)
          }
        }
        break
      case "response_start":
        const newMsg = {
          role: data.role,
          items: [],
          tag: data.tag,
          id: data.id,
        }
        setReasoningProcess((prev) => [...prev, newMsg])
        setReasoningCounter((n) => n + 1)
        msg = newMsg
        break
      case "response_chunk":
        // Append the streaming text to the last item
        if (msg.items.length === 0) {
          msg.items.push({ content: "", type: "text" })
        }
        let last = msg.items[msg.items.length - 1]
        last.content += data.text

        while (true) {
          let hasSplit = false
          if (last.type === "text") {
            // this is safe because context only ever occurs in user messages which come in whole chunks
            while (last.content.includes("BEGIN_CONTEXT: ") && last.content.includes("END_CONTEXT")) {
              // delete everything between BEGIN_CONTEXT and END_CONTEXT
              const startIndex = last.content.indexOf("BEGIN_CONTEXT: ")
              const endIndex = last.content.indexOf("END_CONTEXT")
              const beforeContext = last.content.slice(0, startIndex)
              const afterContext = last.content.slice(endIndex + "END_CONTEXT".length)
              last.content = beforeContext + afterContext
            }

            if (last.content.includes("```python")) {
              const parts = last.content.split("```python")
              last.content = parts[0].trimEnd()

              // Everything after the first ```python
              const remainingText = parts.slice(1).join("```python").trimStart()
              const name = "Python"
              if (last.content.length === 0) {
                // Turn this item into code
                last.type = "code"
                last.content = remainingText
                last.name = name
              } else {
                // Or create a new code item
                msg.items.push({
                  content: remainingText,
                  type: "code",
                  name,
                })
              }
              hasSplit = true
            }
          }
          // If we are in code mode and see ```
          else if (last.type === "code") {
            if (last.content.includes("```")) {
              const parts = last.content.split("```")
              last.content = parts[0].trimEnd()
              last.completed = true

              const remainingText = parts.slice(1).join("```").trimStart()
              // The remainder becomes text again
              msg.items.push({ content: remainingText, type: "text" })
              hasSplit = true
            }
          }

          // If we splitted, we need to re-check
          last = msg.items[msg.items.length - 1]

          if (!hasSplit) break
        }
        setReasoningProcess((prev) => [...prev])
        setReasoningCounter((n) => n + 1)
        break
      case "response_end":
        // No need to handle
        break
      case "usage":
        // Update the usage stats
        break
      case "code_file":
        setCodeFiles((prev) => {
          const newCodeFiles = [...prev, data.code_file]
          setSelectedProgramIndex(newCodeFiles.length - 1)
          return newCodeFiles
        })
        break
      case "execution_start":
        lastExecLog = {
          start_time: data.start_time,
          end_time: 0,
          command: data.command,
          output: "",
          exit_code: -1,
          tag: data.tag,
        }
        setExecutionLog((prev) => [...prev, lastExecLog])
        break
      case "execution_chunk":
        lastExecLog.output += data.output
        setExecutionLog((prev) => [...prev])
        break
      case "execution_end":
        lastExecLog.exit_code = data.exit_code
        lastExecLog.end_time = data.end_time
        setExecutionLog((prev) => [...prev])
        break
      case "output_files":
        setOutputFiles(data.files)
        break
      case "workflow_progress":
        setWorkflowProgress((previous) => {
          const events = workflowRunId.current === data.run_id ? previous : []
          workflowRunId.current = data.run_id
          const existing = events.findIndex((event) => event.step_id === data.step_id)
          if (existing < 0) return [...events, data]
          const updated = [...events]
          updated[existing] = data
          return updated
        })
        break
      default:
        console.warn("Unhandled message type", data)
    }
  }

  const initState = (state: AgentSession) => {
    setAgentSession(state)

    setTaskInst(state.task_instruction)
    setDomainKnowledge(state.domain_knowledge)
    setDescription(state.description)
    setUploadedFiles(
      state.uploaded_files.map((f) => ({
        name: f.name,
        size: f.size,
        progress: 100,
        status: "completed",
      })),
    )
    setCodeFiles(state.code_files)
    setSelectedProgramIndex(state.code_files.length - 1)
    setExecutionLog(state.execution_log)
    setOutputFiles(state.output_files)

    // Check if this is a fresh task (no history) and has task instructions
    // This would indicate it's likely a new task from the gallery
    if (state.history.length === 0 && state.task_instruction) {
      // This is a new task from the gallery, ensure inputs are expanded
      setIsInstructionEditable(true)

      // If sidebar is not open, open it for new tasks
      if (!isSidebarOpen) {
        setIsTransitioning(true)
        setIsSidebarOpen(false)
        setSidebarTab("input")
      }
    }
    else if (state.history.length > 0) {
      setIsInstructionEditable(false)
    }

    // replay the history
    reasoningProcess.length = 0
    setReasoningProcess([])
    state.history.forEach((item) => {
      handleAgentMessage({ type: "response_start", role: item.role, tag: item.tag, id: item.id }, null)
      handleAgentMessage({ type: "response_chunk", text: item.content, id: item.id }, null)
    })
  }

  const ws = useRef<AgentWebSocketConnection | null>(null)

  const safeRunCommand = async (command: string, data?: any, timeout = 0) => {
    if (!ws.current) {
      throw new Error("WebSocket connection not established")
    }

    try {
      return await ws.current.runCommand(command, data, timeout)
    } catch (err) {
      console.error(`Error running command ${command}:`, err)

      if (err instanceof Error && (err.message?.includes("EPIPE") || err.message?.includes("not open"))) {
        setIsConnected(false)
      }

      throw err
    }
  }

  useEffect(() => {
    let cancelled = false
    fetchAccountSession()
      .then((session) => {
        if (!cancelled) setAccountSession(session)
      })
      .catch(() => {
        if (!cancelled) setAccountSession({ connected: false })
      })
      .finally(() => {
        if (!cancelled) setIsAccountLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Initialize the owned conversation only after the Tapis cookie is valid.
  useEffect(() => {
    if (!accountSession.connected) return

    let cancelled = false
    const initializeSession = async () => {
      try {
        let agentSessionId = localStorage.getItem("agentSessionId")

        if (agentSessionId) {
          const result = await validateAgentSession(agentSessionId)
          if (result.error) {
            localStorage.removeItem("agentSessionId")
            agentSessionId = null
          }
        }

        if (!agentSessionId) {
          const created = await createAgentSession()
          if (created.error) throw new Error(created.error)
          agentSessionId = created.agent_session_id
        }

        if (!agentSessionId || cancelled) {
          setError("Failed to start agent session: No session ID received.")
          return
        }

        localStorage.setItem("agentSessionId", agentSessionId)
        localStorage.removeItem("savedSessionIDs")
        setUserSessions(await fetchUserTasks())
        setError("")

        ws.current?.close()
        ws.current = new AgentWebSocketConnection(
          agentSessionId, handleAgentMessage, (connected) => setIsConnected(connected))
      } catch (err: unknown) {
        console.error("Error initializing agent session:", err)
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to communicate with server")
      }
    }

    initializeSession()

    return () => {
      cancelled = true
      if (ws.current) {
        try {
          ws.current.close()
        } catch (err) {
          console.error("Error closing WebSocket connection:", err)
        }
        ws.current = null
      }
    }
  }, [accountSession.connected, accountSession.account?.subject])

  useEffect(
    () => scrollIntoView(userScrolledReasoning, reasoningRef),
    [reasoningCounter],
  )

  useEffect(() => {
    if (generationError) {
      scrollIntoView(false, reasoningRef)
    }
  }, [generationError])

  const { theme, savedTheme } = useTheme()

  const handleFilesAdded = async (newFiles: File[]) => {
    const filesToAdd = newFiles.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      status: "uploading" as const,
    }))

    setUploadedFiles((prev) => [...prev, ...filesToAdd])

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i]
      const filename = filesToAdd[i].name

      try {
        const result = await uploadFile(file, agentSession!.id, (progress) =>
          setUploadedFiles((current) => current.map((f) => (f.name === filename ? { ...f, progress } : f))),
        )

        if (result.success) {
          setUploadedFiles((current) =>
            current.map((f) => (f.name === filename ? { ...f, status: "completed" as const } : f)),
          )
        } else {
          setUploadedFiles((current) =>
            current.map((f) => (f.name === filename ? { ...f, status: "error" as const } : f)),
          )
          console.error(`File upload failed: ${result.error}`)
        }
      } catch (err) {
        setUploadedFiles((current) =>
          current.map((f) => (f.name === filename ? { ...f, status: "error" as const } : f)),
        )
        console.error(`Error uploading file:`, err)
      }
    }
  }

  const handleFileDelete = async (filename: string) => {
    const fileToDelete = uploadedFiles.find((f) => f.name === filename)

    if (!fileToDelete || !agentSession?.id) {
      return
    }

    try {
      const result = await deleteFile(filename, agentSession.id)

      if (result.success) {
        setUploadedFiles((current) => current.filter((f) => f.name !== filename))
      } else {
        console.error(`Failed to delete file: ${result.error}`)
      }
    } catch (err) {
      console.error(`Error deleting file:`, err)
    }
  }

  const handleDeleteProject = async () => {
    if (!agentSession?.id || isGenerating || isRunning || isDeletingProject) {
      return
    }

    setIsDeletingProject(true)
    try {
      const result = await deleteAgentSession(agentSession.id)
      if (result.error) {
        throw new Error(result.error)
      }

      if (localStorage.getItem("agentSessionId") === agentSession.id) {
        localStorage.removeItem("agentSessionId")
      }

      ws.current?.close()
      toast.success("Project deleted.")
      window.location.assign("/")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete project.")
      setIsDeletingProject(false)
    }
  }

  const renderDeleteProjectButton = (showLabel = false) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size={showLabel ? "default" : "icon"}
          className={showLabel ? "justify-start gap-2 text-destructive hover:text-destructive" : "text-destructive hover:text-destructive"}
          disabled={isGenerating || isRunning || isDeletingProject}
          aria-label="Delete project"
          title="Delete project"
        >
          <Trash2 className="h-5 w-5" />
          {showLabel && "Delete Project"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this project?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes this conversation, execution history, and the project&apos;s stored file copies.
            Existing ArrayMorph datasets, Smart Labeler pipelines, and submitted HPC jobs are retained.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeletingProject}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeletingProject}
            onClick={handleDeleteProject}
          >
            {isDeletingProject ? "Deleting..." : "Delete Project"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  const toggleSidebar = () => {
    setIsTransitioning(true)
    setIsSidebarOpen(!isSidebarOpen)
  }

  const handleAccountConnected = (session: AccountSession) => {
    ws.current?.close()
    setAgentSession(undefined)
    setIsConnected(false)
    setError("")
    setAccountSession(session)
    // Start from a clean React lifecycle after the browser has committed the
    // server-managed HttpOnly cookie. This also clears a stale fatal error from
    // an earlier expired-token session.
    window.setTimeout(() => window.location.reload(), 100)
  }

  const handleAccountLoggedOut = () => {
    ws.current?.close()
    setAgentSession(undefined)
    setUserSessions([])
    setIsConnected(false)
    setAccountSession({ connected: false })
  }

  const openConversation = (sessionId: string) => {
    if (sessionId === agentSession?.id) return
    localStorage.setItem("agentSessionId", sessionId)
    window.location.assign("/")
  }

  const createConversation = async () => {
    try {
      const result = await createAgentSession()
      if (result.error) throw new Error(result.error)
      localStorage.setItem("agentSessionId", result.agent_session_id)
      window.location.assign("/")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create a conversation.")
    }
  }

  const conversationTitle = (session: AgentSession) =>
    session.description?.trim()
    || session.task_instruction?.trim().split("\n")[0]
    || "New conversation"

  const getSettings = () => {
    const useSelfDebug = localStorage.getItem("use_self_debug")
    return {
      llm_engine_name: localStorage.getItem("llm_engine_name"),
      llm_api_key: localStorage.getItem("llm_api_key"),
      llm_base_url: localStorage.getItem("llm_base_url"),
      use_self_debug: useSelfDebug === "true" || !useSelfDebug,
    }
  }

  const handleSolveTask = async () => {
    if (!taskInst) {
      toast.error("Please provide a task instruction.")
      return
    }

    if (reasoningCounter > 0 && reasoningProcess.length > 0) {
      setCodeFiles(codeFiles => codeFiles.filter((f) => f.is_gold))
      setReasoningProcess([])
      setExecutionLog([])
      setOutputFiles([])
    }

    setIsGenerating(true)
    workflowRunId.current = null
    setWorkflowProgress([])
    setIsInstructionEditable(false)
    setGenerationError("")
    setCurrentStep(2) // Move to step 2 (Processing)

    safeRunCommand("update_task_inputs", {
      task_instruction: taskInst,
      domain_knowledge: domainKnowledge,
      description,
    })
      .then(() => safeRunCommand("solve_task", { settings: getSettings() }, 0))
      .then(() => {
        setCurrentStep(3) // Move to step 3 (Results)
      })
      .catch((err: unknown) => {
        setGenerationError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        setIsGenerating(false)
      })
  }

  const handleRunProgram = (codeFile: CodeFile) => {
    setIsRunning(true)
    ws.current
      ?.runCommand("run_program", { id: codeFile.id, settings: getSettings() }, 0)
      .then(() => {
        // Command sent successfully
      })
      .catch((err: unknown) => {
        console.error("Error running program:", err)
        setGenerationError("Failed to run program: " + (err instanceof Error ? err.message : String(err)))
      })
      .finally(() => setIsRunning(false))

    // Only switch to results tab in standard mode
    if (!useResizableTabs) {
      setMainTab("results")
    }
  }

  const handleCancel = () => {
    safeRunCommand("cancel")
      .catch((err: unknown) => setGenerationError(err instanceof Error ? err.message : String(err)))
      .finally(() => {
        setIsGenerating(false)
        setIsRunning(false)
      })
  }

  const updateProgramContent = useDebouncedCallback((content: string, codeFile: CodeFile) => {
    ws.current?.runCommand("update_program", { id: codeFile.id, user_content: content })
  }, 500)

  const updateTaskInputs = useDebouncedCallback((
    nextTaskInstruction: string,
    nextDomainKnowledge: string,
    nextDescription: string,
  ) => {
    ws.current?.runCommand("update_task_inputs", {
      task_instruction: nextTaskInstruction,
      domain_knowledge: nextDomainKnowledge,
      description: nextDescription,
    })
  }, 500)

  const addUserMessage = async (
    e: React.KeyboardEvent<HTMLTextAreaElement> | { key: string; target: HTMLInputElement },
  ) => {
    if (isGenerating) {
      // Ignore request if a request is already running
      return
    }

    if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
      const message = (e.target as HTMLInputElement).value.trim()
        ; (e.target as HTMLInputElement).value = ""

      setIsGenerating(true)
      workflowRunId.current = null
      setWorkflowProgress([])
      setGenerationError("")
      ws.current
        ?.runCommand("follow_up", {
          message: message,
          code_id: codeFiles[selectedProgramIndex]?.id,
          settings: getSettings(),
        }, 0)
        .catch((err: unknown) => setGenerationError(err instanceof Error ? err.message : String(err)))
        .finally(() => setIsGenerating(false))
    }
  }

  const renderConversations = () => (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="border-b border-border p-4">
        <Button className="w-full gap-2" onClick={() => void createConversation()}>
          <Plus className="h-4 w-4" /> New Conversation
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {userSessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => openConversation(session.id)}
              className={`w-full border-l-2 px-3 py-3 text-left transition-colors ${
                session.id === agentSession?.id
                  ? "border-primary bg-muted"
                  : "border-transparent hover:bg-muted/60"
              }`}
            >
              <p className="truncate text-sm font-medium">{conversationTitle(session)}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {session.history?.at(-1)?.content || "No messages yet"}
              </p>
            </button>
          ))}
          {userSessions.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No conversations yet.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  )

  const renderLLMSettings = () => (
    <>
      <LocalStorageInput
        storageKey="llm_engine_name"
        label="LLM Engine"
        placeholder="openai/gpt-4.1"
        help="The LLM engine to use for reasoning and code generation."
        type="text"
      />

      <LocalStorageInput
        storageKey="llm_api_base"
        label="LLM API Base URL (optional)"
        placeholder="https://api.example.com"
        help="OpenAI-compatible URL for the LLM API service. Derived from LLM engine name if not provided."
        type="text"
      />

      <LocalStorageInput
        storageKey="llm_api_key"
        label="LLM API Key"
        placeholder="API key"
        help="Your API key for the LLM service."
        type="password"
        showToggle={true}
      />
    </>
  )

  const renderSettings = () => (
    <div className="p-4 space-y-5">
      <div className="flex flex-row items-center gap-4">
        <ThemeDropdown className="" />
        <Label>UI Theme: {savedTheme.toUpperCase()}</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch id="resizable-tabs" checked={useResizableTabs} onCheckedChange={val => {
          localStorage.setItem("useResizableTabs", val.toString())
          setUseResizableTabs(val)
        }} />
        <Label htmlFor="resizable-tabs">Use Resizable Tabs</Label>
      </div>

      <LocalStorageSwitch
        storageKey="use_self_debug"
        label="Use Self-Debug"
        help="Enable or disable the self-debugging feature of the agent."
        defaultValue={true}
      />

      <div className="border-t border-border pt-5">
        <h3 className="text-sm font-semibold mb-4">ICICLE Access</h3>
        <TapisAccountControl
          session={accountSession}
          onConnected={handleAccountConnected}
          onLoggedOut={handleAccountLoggedOut}
        />
      </div>

      {renderLLMSettings()}

    </div>
  )

  const renderHistoryBlock = (message: ReasoningItem, item: ReasoningItemBlock) => {
    if (item.type === "text") {
      return (
        <div className="break-words">
          <MarkdownRenderer content={item.content} />
        </div>
      )
    } else {
      const blockIdx = message.items.filter((d) => d.type === "code").indexOf(item)
      const codeFileIndex = codeFiles.findIndex((f) => f.history_id === message.id && f.block_index === blockIdx)
      const codeFile = codeFiles[codeFileIndex]
      return (
        <CodeBlockRenderer
          showToolbar={message.tag !== "system"}
          isLoading={!item.completed && isGenerating}
          content={codeFile ? codeFile.content : item.content}
          codeFile={codeFile}
          onOpenInEditor={() => {
            if (useResizableTabs) {
              setActivePanel("program")
            } else {
              setMainTab("program")
            }
            setSelectedProgramIndex(codeFileIndex)
          }}
        />
      )
    }
  }

  const renderTaskInputs = (labelPrefix: string, textSize="text-base") => (
    <>
      <div>
        <Label htmlFor={`${labelPrefix}_task_inst`} className={`${textSize} font-semibold flex items-center gap-2`}>
          <FileText className="h-5 w-5 text-primary" />
          Request
          <TooltipProvider>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Describe what you want the agent to do with your uploaded files.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Label>
        <Textarea
          id={`${labelPrefix}_task_inst`}
          placeholder="Describe what you want done with your files."
          value={taskInst}
          onChange={(e) => {
            const nextTaskInstruction = e.target.value
            setTaskInst(nextTaskInstruction)
            updateTaskInputs(nextTaskInstruction, domainKnowledge, description)
          }}
          className="mt-2 min-h-32 text-base"
        />
      </div>
      <div>
        <Label htmlFor={`${labelPrefix}_domain_knowledge`} className={`${textSize} font-semibold flex items-center gap-2`}>
          <Info className="h-5 w-5 text-primary" />
          Domain Knowledge
          <TooltipProvider>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Add any specialized knowledge or context that might help with your analysis, such as definitions of
                  technical or scientific terms, snippets of relevent documentation, or important background information.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Label>
        <Textarea
          id={`${labelPrefix}_domain_knowledge`}
          placeholder="Add any specialized knowledge or context that might help with your analysis."
          value={domainKnowledge}
          onChange={(e) => {
            const nextDomainKnowledge = e.target.value
            setDomainKnowledge(nextDomainKnowledge)
            updateTaskInputs(taskInst, nextDomainKnowledge, description)
          }}
          className="mt-2 min-h-32 text-base"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className={`${textSize} font-semibold flex items-center gap-2`}>
            <Files className="h-5 w-5 text-primary" />
            Data Files ({uploadedFiles.length})
            <TooltipProvider>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">Upload the image or data file for this request.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 flex items-center gap-1"
            onClick={(e) => {
              e.preventDefault()
              setSidebarFilesDropdownOpen(!sidebarFilesDropdownOpen)
            }}
          >
            {sidebarFilesDropdownOpen ? "Hide Files" : "Show Files"}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${sidebarFilesDropdownOpen ? "" : "-rotate-90"}`}
            />
          </Button>
        </div>
        <div className="mb-6 grid grid-cols-1">
          <FileUploader
            files={sidebarFilesDropdownOpen ? uploadedFiles : []}
            onFilesAdded={handleFilesAdded}
            onFileDelete={handleFileDelete}
            multiple={true}
            maxSize={64 * 1024 * 1024}
          />
        </div>
      </div>
    </>
  )

  const renderReasoningPanel = () => (
    <div className="w-full h-full flex flex-col">
      <ScrollArea
        className="px-4 pb-4 w-full flex-1"
        onScroll={(event) => {
          const target = event.currentTarget
          const isAtBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 150
          setUserScrolledReasoning(!isAtBottom)
        }}
      >
        <Card className="max-w-4xl m-auto mt-4 mb-6">
          {!isInstructionEditable ? (<>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Request
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setIsInstructionEditable(true)}
                >
                  <Edit className="h-4 w-4" />
                  <span className="">Edit</span>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2">
                <h3 className="font-semibold text-base mb-1">Request</h3>
                <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-md border border-border">
                  {taskInst}
                </p>
              </div>
              {domainKnowledge && (
                <div className="mb-2">
                  <h3 className="font-semibold text-base mb-1">Domain Knowledge</h3>
                  <ScrollArea className="rounded-md border border-border">
                    <div className="max-h-40">
                      <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3">
                        {domainKnowledge}
                      </p>
                    </div>
                  </ScrollArea>
                </div>
              )}
              {uploadedFiles.length > 0 && (
                <div>
                  <h3 className="font-semibold text-base mb-1 flex items-center gap-2">
                    <Files className="h-4 w-4" />
                    Files ({uploadedFiles.length})
                  </h3>
                  <ul className="text-sm bg-muted/30 p-3 rounded-md border border-border">
                    {uploadedFiles.map((file, idx) => (
                      <li key={idx} className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="font-mono text-xs">
                          {formatFileSize(file.size)}
                        </Badge>
                        {file.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </>) : (<>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold">1</span>
                New Request
                {reasoningCounter > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => setIsInstructionEditable(false)}
                  >
                    <ChevronUp className="h-4 w-4" />
                    <span className="">Collapse</span>
                  </Button>
                )}
              </CardTitle>
              <CardDescription>Upload your data and tell the agent what to do</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 space-y-5">{renderTaskInputs("reasoning", "text-lg")}</div>
            </CardContent>
            <CardFooter className="flex justify-end">
              {reasoningCounter > 0 && <AlertDialog>
                <AlertDialogTrigger disabled={isGenerating} asChild>
                  <Button
                    disabled={isGenerating}
                    className="font-bold py-6 text-lg gap-2"
                    size="lg"
                  >
                    Start Over
                    <ArrowBigRight className="w-5 h-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to restart the analysis?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action will permanently clear the current analysis, code files, execution traces, and output files.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSolveTask}>Continue</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>}

              {reasoningCounter == 0 && 
              <Button
                onClick={handleSolveTask}
                disabled={isGenerating}
                className="font-bold py-6 text-lg gap-2"
                size="lg"
              >
                Run Request
                <ArrowBigRight className="w-5 h-5" />
              </Button>}
            </CardFooter>
          </>)}
          </Card>

        {reasoningProcess.map(
          (message, idx) =>
            message.tag !== "system" && (
              <div
                key={idx}
                className={`relative mb-4 max-w-4xl grid grid-cols-1 min-w-0 m-auto p-5 rounded-2xl rounded-br-md ${message.role === "user" ? "bg-muted" : "bg-background"}`}
              >
                <div className="font-semibold mb-2 flex items-center gap-2">
                  {message.role === "user" ? (
                    <>
                      <Badge variant="outline" className="bg-primary/10">
                        You
                      </Badge>
                    </>
                  ) : (
                    <>
                      <Badge variant="secondary">
                        AI Assistant
                      </Badge>
                    </>
                  )}
                </div>
                {message.items.map((item, i) => (
                  <div key={i}>{renderHistoryBlock(message, item)}</div>
                ))}
              </div>
            ),
        )}

        {generationError && (
          <div className="m-auto p-4 bg-destructive/15 rounded-lg border border-destructive text-sm w-fit min-w-20 font-bold flex flex-row align-middle justify-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Request stopped unexpectedly: {generationError}
          </div>
        )}

        <div ref={reasoningRef} />
      </ScrollArea>

      {reasoningProcess.length > 0 && (
        <div className="relative flex px-4 w-[40rem] max-w-full m-auto rounded-2xl mb-4">
          <Button
            variant="outline"
            className={`absolute top-1 left-2 translate-x-1/2 z-10 w-8 h-8 rounded-full shadow-md bg-muted transition-all duration-300 ${userScrolledReasoning ? "opacity-100 -translate-y-10" : "opacity-0 translate-y-0"}`}
            onClick={() => reasoningRef.current?.scrollIntoView({ behavior: "smooth" })}
          >
            <ArrowDown className="h-6 w-6" />
          </Button>

          <Textarea
            placeholder="Type your message..."
            className="flex-1 p-5 rounded-2xl bg-muted min-h-[60px] max-h-[150px] resize-none"
            onKeyDown={(e) => {
              // Allow Shift+Enter for new lines
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                addUserMessage(e)
              }
              // Auto-adjust height
              const textarea = e.target as HTMLTextAreaElement
              textarea.style.height = "auto"
              textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
            }}
            onChange={(e) => {
              // Auto-adjust height on typing
              const textarea = e.target as HTMLTextAreaElement
              textarea.style.height = "auto"
              textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
            }}
            id="chat-input"
          />
          <Button
            className="absolute right-8 rounded-md bottom-0 -translate-y-1/2"
            variant="ghost"
            disabled={isGenerating}
            onClick={() => {
              const input = document.getElementById("chat-input") as HTMLInputElement
              if (input && input.value.trim()) {
                addUserMessage({ key: "Enter", target: input })
              }
            }}
          >
            <Send className="!h-5 !w-5" />
          </Button>
        </div>
      )}
    </div>
  )

  const renderProgramPanel = () => {
    if (codeFiles.length === 0) {
      return (
        <div className="p-6 text-center w-full flex flex-col items-center justify-center h-full">
          <FileCode className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">No Code Generated Yet</h3>
          <p className="text-muted-foreground max-w-md mb-4">
            Generated code will appear here when a request produces a program.
          </p>
          {reasoningCounter === 0 && (
            <Button onClick={handleSolveTask} disabled={isGenerating} className="mt-4">
              Run Request
              <ArrowBigRight className="ml-2 w-5 h-5" />
            </Button>
          )}
        </div>
      )
    }

    return <CodeEditorPanel
      codeFiles={codeFiles}
      selectedProgramIndex={selectedProgramIndex}
      isDiffViewActive={isDiffViewActive}
      isRunning={isRunning}
      isGenerating={isGenerating}
      executionLog={executionLog}
      onSelectedProgramIndexChange={setSelectedProgramIndex}
      onDiffViewActiveChange={setIsDiffViewActive}
      onRunProgram={handleRunProgram}
      onProgramContentChange={updateProgramContent}
      onExecutionLogClear={() => setExecutionLog([])}
    />
  }

  const renderResultsPanel = () => <ResultsPanel
    outputFiles={outputFiles}
    isProgramRunnable={codeFiles.length > 0}
    isBusy={isRunning || isGenerating}
    onRunProgram={() => handleRunProgram(codeFiles[selectedProgramIndex])}
  />

  const renderStandardTabs = () => (
    <Tabs
      value={mainTab}
      onValueChange={(val) => setMainTab(val as PanelType)}
      className="h-screen flex flex-col flex-1 w-full"
    >
      <TabsList className="flex justify-between border-border bg-background min-h-[5rem] max-h-[4rem] align-middle w-full p-0 m-0">
        <TabsTrigger value="reasoning" className="flex-1 text-lg py-4 px-6">
          <MessageSquare className="w-5 h-5 mr-3" />
          Agent Activity
        </TabsTrigger>
        <TabsTrigger value="program" className="flex-1 text-lg py-4 px-6">
          <FileCode className="w-5 h-5 mr-3" />
          Generated Program
        </TabsTrigger>
        {outputFiles.length > 0 && (
          <TabsTrigger value="results" className="flex-1 text-lg py-4 px-6">
            <BarChart className="w-5 h-5 mr-3" />
            Execution Results
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="reasoning" className="flex-1 h-[calc(100vh-4rem)] mt-0 overflow-hidden">
        <div className="w-full h-full">{renderReasoningPanel()}</div>
      </TabsContent>

      <TabsContent value="program" className="flex-1 h-[calc(100vh-4rem)] mt-0 overflow-hidden">
        <div className="w-full h-full">{renderProgramPanel()}</div>
      </TabsContent>

      {outputFiles.length > 0 && (
        <TabsContent value="results" className="flex-1 h-[calc(100vh-4rem)] mt-0 overflow-hidden">
          <div className="w-full h-full">{renderResultsPanel()}</div>
        </TabsContent>
      )}
    </Tabs>
  )

  const renderResizablePanels = () => {
    const panels = {
      reasoning: {
        title: "Agent Activity",
        icon: <MessageSquare className="h-5 w-5 text-primary" />,
        render: renderReasoningPanel,
        defaultSize: 50,
      },
      program: {
        title: "Generated Program",
        icon: <FileCode className="h-5 w-5 text-primary" />,
        render: renderProgramPanel,
        defaultSize: 50,
      },
      results: {
        title: "Execution Results",
        icon: <BarChart className="h-5 w-5 text-primary" />,
        render: renderResultsPanel,
        defaultSize: 25,
      },
    }

    return (
      <ResizablePanels
        panels={panels}
        activatedPanels={activatedPanels}
        isRunning={isRunning}
      />
    )
  }

  useEffect(() => {
    if (codeFiles.length > 0 &&
      !(codeFiles.length === 1 && codeFiles[0].is_gold)) {
      setActivatedPanels((prev) => prev.includes("program") ? prev : [...prev, "program"])
    }

    // Remove results panel when there are no output files
    if (outputFiles.length === 0 && activatedPanels.includes("results")) {
      setActivatedPanels((prev) => prev.filter((p) => p !== "results"))
      if (activePanel === "results") {
        setActivePanel(activatedPanels.filter((p) => p !== "results")[0] || "reasoning")
      }
    }

    // Show the results panel whenever output files exist
    if (outputFiles.length > 0) {
      setActivatedPanels((prev) => prev.includes("results") ? prev : [...prev, "results"])
    }
  }, [codeFiles, useResizableTabs, outputFiles, activePanel, isRunning])

  if (isAccountLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-primary" />
      </div>
    )
  }

  if (!accountSession.connected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="w-full max-w-md border border-border bg-background p-6 shadow-lg">
          <h1 className="text-2xl font-bold text-primary">ICICLE Science Agent</h1>
          <p className="mb-6 mt-2 text-sm text-muted-foreground">
            {accountSession.error || "Your ICICLE session is unavailable. Open Science Agent from the ICICLE hub."}
          </p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">Error</h2>
        <p className="text-muted-foreground">{error}</p>
        <Button variant="default" onClick={() => window.location.reload()}>
          Reload Application
        </Button>
      </div>
    )
  }

  if (!agentSession || !isConnected) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
        <div className="font-bold text-xl">
          {!agentSession ? "Connecting to Science Agent..." : "Connection lost, reconnecting to Science Agent..."}
        </div>
        <p className="text-muted-foreground max-w-md text-center">
          This may take a few moments. Please wait while we establish a secure connection.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-screen text-primary">
      <Button
        variant="outline"
        size="icon"
        className={`fixed top-5 z-40 transition-all duration-100 ${isSidebarOpen ? "left-5" : "left-3"} opacity-80`}
        onClick={toggleSidebar}
      >
        {isSidebarOpen ? <SidebarClose className="!h-6 !w-6" /> : <Settings className="!h-6 !w-6" />}
      </Button>

      <div
        className={`border-r border-border transition-all duration-100 fixed top-0 left-0 z-30 h-full ${isSidebarOpen ? "w-[22rem]" : "w-16"
          } flex flex-col justify-start bg-background shadow-md`}
      >
        <div
          className={`flex items-center justify-between min-h-[5rem] max-h-[5rem] ${isSidebarOpen ? "px-6 pl-16" : "justify-center px-2"} border-b border-border`}
        >
          {isSidebarOpen && (
            <>
              <h1 className="text-xl text-primary font-extrabold">ICICLE Science Agent</h1>
              {renderDeleteProjectButton()}
            </>
          )}
        </div>

        {!isSidebarOpen && (
          <div className="flex flex-col items-center h-full justify-end pb-6 space-y-2">
            <Link to="/gallery">
              <Button variant="outline" size="icon" className="relative group text-base mt-4">
                <House className="w-5 h-5" />
                <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                  Gallery
                </span>
              </Button>
            </Link>
            <Link to="/storage">
              <Button variant="outline" size="icon" className="relative group text-base">
                <Database className="w-5 h-5" />
                <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                  S3 Storage
                </span>
              </Button>
            </Link>
            {renderDeleteProjectButton()}
            <div className="flex-1" />
            <ThemeToggle />
          </div>
        )}

        {isSidebarOpen && (
          <div
            className={`transition-opacity duration-100 ${isSidebarOpen && !isTransitioning ? "opacity-100" : "opacity-0 pointer-events-none"
              }]`}
          >
            <div className="h-11 border-b border-border px-4 flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/gallery"><House className="h-4 w-4" /> Projects</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/storage"><Database className="h-4 w-4" /> S3 Storage</Link>
              </Button>
            </div>
            <Tabs value={sidebarTab} onValueChange={(val) => setSidebarTab(val as "conversations" | "input" | "settings")}>
              <TabsList className="grid h-12 w-full grid-cols-3 rounded-none bg-muted/30">
                <TabsTrigger value="conversations" className="gap-1 text-sm font-semibold data-[state=active]:bg-background">
                  <MessageSquare className="h-4 w-4" /> Chats
                </TabsTrigger>
                <TabsTrigger value="input" className="gap-1 text-sm font-semibold data-[state=active]:bg-background">
                  <Zap className="h-4 w-4" /> Input
                </TabsTrigger>
                <TabsTrigger value="settings" className="gap-1 text-sm font-semibold data-[state=active]:bg-background">
                  <Settings className="h-4 w-4" /> Settings
                </TabsTrigger>
              </TabsList>
              <TabsContent value="conversations" className="mt-0">
                {renderConversations()}
              </TabsContent>
              <TabsContent value="input" className="">
                <div className="flex flex-col h-[calc(100vh-8rem)]">
                  <ScrollArea className="flex-1 overflow-auto">
                    <div className="p-4 space-y-5">{renderTaskInputs("side_panel")}</div>
                  </ScrollArea>
                  <div className="p-4 bg-background border-t border-border">

                    {reasoningCounter > 0 && <AlertDialog>
                      <AlertDialogTrigger disabled={isGenerating} className="w-full" asChild>
                        <Button
                          disabled={isGenerating}
                          className="font-bold w-full py-6 text-lg gap-2"
                          size="lg"
                        >
                    Start Over
                          <ArrowBigRight className="w-5 h-5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure you want to restart the analysis?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action will permanently clear the current analysis, code files, execution traces, and output files.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleSolveTask}>Continue</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>}

                    {reasoningCounter == 0 && 
                    <Button
                      onClick={handleSolveTask}
                      disabled={isGenerating}
                      className="font-bold w-full py-6 text-lg gap-2"
                      size="lg"
                    >
                      Run Request
                      <ArrowBigRight className="w-5 h-5" />
                    </Button>}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="settings" className="">
                <ScrollArea className="h-[calc(100vh-5rem)]">{renderSettings()}</ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      <div
        className={`flex-1 flex flex-col transition-all duration-100 w-full ${isSidebarOpen ? "pl-[22rem]" : "pl-16"}`}
      >
        {(isGenerating || isRunning || workflowProgress.some((event) => event.status === "failed")) && (
          <LiveWorkflowProgress
            events={workflowProgress}
            isActive={isGenerating || isRunning}
            onStop={handleCancel}
            onDismiss={() => setWorkflowProgress([])}
          />
        )}
        {reasoningCounter == 0 && <WorkflowStepsIndicator currentStep={currentStep}/>}
        {useResizableTabs ? renderResizablePanels() : renderStandardTabs()}
      </div>

      {showLLMModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg bg-background border border-border rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <AlertCircle className="inline-block" />
                Configure LLM Provider
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              You need to configure your LLM provider in order to generate analyses and code.
              You can set this up now or set it later in settings.
            </p>

            <div className="space-y-4">
              {renderLLMSettings()}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" onClick={() => setShowLLMModal(false)}>
                Set Later in Settings
              </Button>
              <Button onClick={() => setShowLLMModal(false)}>
                Save & Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      <HelpModal />
    </div>
  )
}

export default Execution
