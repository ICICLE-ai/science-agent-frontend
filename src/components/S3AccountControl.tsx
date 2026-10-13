import { useEffect, useState } from "react"
import { Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { accountS3Settings } from "@/api/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function S3AccountControl() {
  const [fields, setFields] = useState({ endpoint: "https://s3gateway.pods.icicleai.tapis.io", bucket: "scienceagent", region: "tacc", access_key_id: "", secret_access_key: "" })
  const [configured, setConfigured] = useState(false)
  const [busy, setBusy] = useState(true)
  useEffect(() => {
    let active = true
    accountS3Settings().then((result) => {
      if (!active) return
      setConfigured(result.configured)
      if (result.profile) setFields((value) => ({ ...value, ...result.profile }))
    }).catch((error) => { if (active) toast.error(error.message) })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [])
  const save = async () => {
    setBusy(true)
    try {
      await accountS3Settings("PUT", fields)
      setConfigured(true)
      setFields((value) => ({ ...value, access_key_id: "", secret_access_key: "" }))
      toast.success("S3 settings saved.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save S3 settings.")
    } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!window.confirm("Remove saved S3 credentials? Stored objects will not be deleted.")) return
    setBusy(true)
    try {
      await accountS3Settings("DELETE")
      setConfigured(false)
      setFields((value) => ({ ...value, access_key_id: "", secret_access_key: "" }))
      toast.success("S3 credentials removed.")
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not remove S3 settings.") }
    finally { setBusy(false) }
  }
  const labels = { endpoint: "S3 Endpoint", bucket: "Bucket", region: "Region", access_key_id: "Access Key", secret_access_key: "Secret Key" }
  return <section className="space-y-3 border-t border-border pt-4">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-medium">S3 Storage</h3>
      <span className="text-xs text-muted-foreground">{busy ? "Loading..." : configured ? "Saved" : "Not configured"}</span>
    </div>
    {(Object.keys(labels) as (keyof typeof fields)[]).map((field) => <div key={field}>
      <Label htmlFor={`s3-${field}`}>{labels[field]}</Label>
      <Input id={`s3-${field}`} type={field.includes("key") ? "password" : "text"}
        autoComplete="off" value={fields[field]} disabled={busy}
        placeholder={configured && field.includes("key") ? "Unchanged" : undefined}
        onChange={(event) => setFields((value) => ({ ...value, [field]: event.target.value }))} />
    </div>)}
    <div className="flex gap-2">
      <Button onClick={save} disabled={busy || ((!fields.access_key_id || !fields.secret_access_key) && !(configured && !fields.access_key_id && !fields.secret_access_key))} className="flex-1"><Save className="mr-2 h-4 w-4" />Save S3</Button>
      {configured && <Button variant="ghost" size="icon" title="Remove saved S3 credentials" onClick={remove} disabled={busy}><Trash2 className="h-4 w-4" /></Button>}
    </div>
  </section>
}
