import { UserRound } from "lucide-react"
import type { AccountSession } from "@/api/api"
import { S3AccountControl } from "@/components/S3AccountControl"

interface TapisAccountControlProps {
  session: AccountSession
  onConnected: (session: AccountSession) => void
  onLoggedOut: () => void
}

export function TapisAccountControl({ session }: TapisAccountControlProps) {
  return <div className="space-y-4">
    {session.connected && session.account && <>
      <div className="flex items-center gap-3 border border-border p-3">
        <UserRound className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{session.account.username}</p>
          <p className="truncate text-xs text-muted-foreground">{session.account.tenant_id}</p>
        </div>
      </div>
      <S3AccountControl key={session.account.subject} />
    </>}
  </div>
}
