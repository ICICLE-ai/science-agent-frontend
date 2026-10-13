import { useEffect, useState } from "react"
import { Pencil, Plus, Save, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { accountS3Settings, deleteS3Credentials, importS3Credentials, saveS3Credentials, selectS3Credentials } from "@/api/api"
import type { S3CredentialInput, S3Settings } from "@/api/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const emptyFields: S3CredentialInput = { name: "", endpoint: "", bucket: "", region: "", access_key_id: "", secret_access_key: "" }
const emptySettings: S3Settings = { configured: false, profile: null, profiles: [], selected_profile_id: null }

export function S3AccountControl() {
  const [settings, setSettings] = useState<S3Settings>(emptySettings)
  const [fields, setFields] = useState<S3CredentialInput>(emptyFields)
  const [editor, setEditor] = useState<string | null>(null)
  const [credentialFile, setCredentialFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let active = true
    accountS3Settings().then((result) => {
      if (active) setSettings(result)
    }).catch((error) => { if (active) toast.error(error.message) })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [])

  const startNew = () => {
    setFields({ ...emptyFields })
    setCredentialFile(null)
    setEditor("new")
  }

  const editSelected = () => {
    if (!settings.profile) return
    const { name, endpoint, bucket, region } = settings.profile
    setFields({ ...emptyFields, name, endpoint, bucket, region })
    setCredentialFile(null)
    setEditor(settings.profile.id)
  }

  const choose = async (id: string) => {
    setBusy(true)
    try {
      setSettings(await selectS3Credentials(id === "none" ? null : id))
      setEditor(null)
      setFields({ ...emptyFields })
      setCredentialFile(null)
      toast.success(id === "none" ? "S3 selection cleared." : "S3 credentials selected.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not select S3 credentials.")
    } finally { setBusy(false) }
  }

  const save = async () => {
    setBusy(true)
    try {
      const result = credentialFile
        ? await importS3Credentials(credentialFile, fields)
        : await saveS3Credentials(fields, editor && editor !== "new" ? editor : undefined)
      setSettings(result)
      setFields({ ...emptyFields })
      setCredentialFile(null)
      setEditor(null)
      toast.success("S3 credentials saved.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save S3 credentials.")
    } finally { setBusy(false) }
  }

  const remove = async () => {
    if (!settings.profile || !window.confirm(`Remove "${settings.profile.name}"? Stored objects will remain.`)) return
    setBusy(true)
    try {
      setSettings(await deleteS3Credentials(settings.profile.id))
      setEditor(null)
      setFields({ ...emptyFields })
      setCredentialFile(null)
      toast.success("S3 credentials removed.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove S3 credentials.")
    } finally { setBusy(false) }
  }

  const chooseFile = (file: File | undefined) => {
    if (!file) {
      setCredentialFile(null)
      return
    }
    if (file.size > 64 * 1024) {
      setCredentialFile(null)
      toast.error("Credential file must be 64 KiB or smaller.")
      return
    }
    setCredentialFile(file)
    setFields((value) => ({ ...value, name: value.name || file.name.replace(/\.[^.]+$/, "") }))
  }

  const labels = { name: "Name", endpoint: "S3 Endpoint", bucket: "Bucket", region: "Region", access_key_id: "Access Key", secret_access_key: "Secret Key" }
  const canSave = credentialFile || (fields.name && fields.endpoint && fields.bucket && fields.region &&
    ((fields.access_key_id && fields.secret_access_key) || (editor !== "new" && !fields.access_key_id && !fields.secret_access_key)))

  return <section className="space-y-3 border-t border-border pt-4">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-medium">S3 Credentials</h3>
      <Button variant="ghost" size="icon" title="Add S3 credentials" aria-label="Add S3 credentials" onClick={startNew} disabled={busy}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
    <Label htmlFor="s3-selected">Selected credentials</Label>
    <div className="flex items-center gap-1">
      <Select value={settings.selected_profile_id || "none"} onValueChange={choose} disabled={busy}>
        <SelectTrigger id="s3-selected" className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No credentials selected</SelectItem>
          {settings.profiles.map((profile) => <SelectItem key={profile.id} value={profile.id}>{profile.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button variant="ghost" size="icon" title="Edit selected credentials" aria-label="Edit selected credentials" onClick={editSelected} disabled={busy || !settings.profile}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" title="Delete selected credentials" aria-label="Delete selected credentials" onClick={remove} disabled={busy || !settings.profile}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
    {settings.profile && <p className="break-all text-xs text-muted-foreground">{settings.profile.bucket} · {settings.profile.region}</p>}
    {editor && <div className="space-y-3 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{editor === "new" ? "New credentials" : "Edit credentials"}</h4>
        <Button variant="ghost" size="icon" title="Close credential editor" aria-label="Close credential editor" disabled={busy}
          onClick={() => { setEditor(null); setFields({ ...emptyFields }); setCredentialFile(null) }}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {editor === "new" && <div>
        <Label htmlFor="s3-file">Credential file</Label>
        <Input id="s3-file" type="file" accept=".json,.env,.key,.ini,.txt" disabled={busy}
          onChange={(event) => chooseFile(event.target.files?.[0])} />
      </div>}
      {(Object.keys(labels) as (keyof S3CredentialInput)[]).filter((field) => !credentialFile || !field.includes("key")).map((field) => <div key={field}>
        <Label htmlFor={`s3-${field}`}>{labels[field]}</Label>
        <Input id={`s3-${field}`} type={field.includes("key") ? "password" : "text"}
          autoComplete="off" value={fields[field]} disabled={busy}
          placeholder={editor !== "new" && field.includes("key") ? "Unchanged" : undefined}
          onChange={(event) => setFields((value) => ({ ...value, [field]: event.target.value }))} />
      </div>)}
      <Button onClick={save} disabled={busy || !canSave} className="w-full"><Save className="mr-2 h-4 w-4" />Save credentials</Button>
    </div>}
  </section>
}
