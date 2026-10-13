import {
  CheckCircle2,
  Circle,
  LoaderCircle,
  Square,
  X,
  XCircle,
} from "lucide-react"

import type { AgentMessageWorkflowProgress } from "@/api/api"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"


interface LiveWorkflowProgressProps {
  events: AgentMessageWorkflowProgress[]
  isActive: boolean
  onStop: () => void
  onDismiss: () => void
}


const statusIcon = (status: AgentMessageWorkflowProgress["status"]) => {
  if (status === "completed") {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
  }
  if (status === "failed") {
    return <XCircle className="h-4 w-4 shrink-0 text-destructive" />
  }
  return <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-primary" />
}


export function LiveWorkflowProgress({
  events,
  isActive,
  onStop,
  onDismiss,
}: LiveWorkflowProgressProps) {
  const latest = events.at(-1)
  const hasFailure = events.some((event) => event.status === "failed")

  return (
    <div className="fixed bottom-6 left-1/2 z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 border border-border bg-background shadow-xl">
      <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {hasFailure ? "Workflow stopped" : isActive ? "Working on request" : "Workflow update"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {latest?.label || "Starting Science Agent"}
          </p>
        </div>
        {isActive ? (
          <Button variant="destructive" size="sm" className="shrink-0 gap-2" onClick={onStop}>
            <Square className="h-3.5 w-3.5" /> Stop
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="shrink-0" onClick={onDismiss} title="Dismiss workflow status">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="max-h-72">
        <div className="divide-y divide-border">
          {events.length === 0 && (
            <div className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
              <Circle className="h-4 w-4" /> Waiting for the first update
            </div>
          )}
          {events.map((event) => (
            <div key={`${event.run_id}:${event.step_id}`} className="flex gap-3 px-4 py-3">
              <div className="pt-0.5">{statusIcon(event.status)}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-5">{event.label}</p>
                {event.detail && (
                  <p className="mt-0.5 break-words text-xs leading-5 text-muted-foreground">
                    {event.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
