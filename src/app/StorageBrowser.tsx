"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Box,
  ChevronRight,
  Database,
  Download,
  FileArchive,
  Folder,
  House,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import {
  deleteStorageObject,
  deleteStoragePrefix,
  fetchStorageObjects,
  storageDownloadUrl,
  type StorageListing,
} from "@/api/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/ThemeToggleButton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatFileSize } from "@/lib/utils"

const ROOT_PREFIX = "science-agent/"

type DeleteTarget = {
  kind: "object" | "folder"
  name: string
  path: string
}

const StorageBrowser = () => {
  const [prefix, setPrefix] = useState(ROOT_PREFIX)
  const [listing, setListing] = useState<StorageListing | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadObjects = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setListing(await fetchStorageObjects(prefix))
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load S3 objects."
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [prefix])

  useEffect(() => {
    loadObjects()
  }, [loadObjects])

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return

    setDeleting(true)
    try {
      const result = deleteTarget.kind === "object"
        ? await deleteStorageObject(deleteTarget.path)
        : await deleteStoragePrefix(deleteTarget.path)
      toast.success(
        deleteTarget.kind === "object"
          ? `${deleteTarget.name} deleted.`
          : `${deleteTarget.name} deleted with ${result.deleted_count} object${result.deleted_count === 1 ? "" : "s"}.`,
      )
      setDeleteTarget(null)
      await loadObjects()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete the storage item.")
    } finally {
      setDeleting(false)
    }
  }

  const folders = useMemo(
    () => (listing?.folders || []).filter((item) => item.name.toLowerCase().includes(search.toLowerCase())),
    [listing, search],
  )
  const objects = useMemo(
    () => (listing?.objects || []).filter((item) => item.name.toLowerCase().includes(search.toLowerCase())),
    [listing, search],
  )
  const totalBytes = useMemo(
    () => (listing?.objects || []).reduce((total, item) => total + item.size, 0),
    [listing],
  )

  const segments = prefix.replace(/\/$/, "").split("/")
  const breadcrumbs = segments.map((segment, index) => ({
    label: index === 0 ? listing?.bucket || "scienceagent" : segment,
    prefix: `${segments.slice(0, index + 1).join("/")}/`,
  }))

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="h-16 border-b border-border bg-background/95 backdrop-blur-sm flex items-center px-4 md:px-6 justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Database className="h-5 w-5 shrink-0" />
            <span className="font-bold truncate">ICICLE Science Agent</span>
          </div>
          <nav className="hidden sm:flex items-center gap-1 border-l border-border pl-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/"><House /> Workspace</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/gallery"><Box /> Projects</Link>
            </Button>
            <Button variant="secondary" size="sm"><Database /> S3 Storage</Button>
          </nav>
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-[1440px] mx-auto px-4 md:px-8 py-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <h1 className="text-2xl font-semibold">S3 Storage</h1>
            <p className="text-sm text-muted-foreground mt-1">
              ArrayMorph datasets in <span className="font-mono">{listing?.bucket || "scienceagent"}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter this folder"
                className="pl-9"
              />
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={loadObjects}
                    disabled={loading}
                    aria-label="Refresh objects"
                  >
                    <RefreshCw className={loading ? "animate-spin" : ""} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh objects</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="h-12 flex items-center gap-1 overflow-x-auto border-b border-border text-sm">
          {breadcrumbs.map((item, index) => (
            <div key={item.prefix} className="flex items-center shrink-0">
              {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
              <button
                className="hover:bg-accent rounded px-2 py-1.5 font-medium"
                onClick={() => { setPrefix(item.prefix); setSearch("") }}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="w-full text-sm table-fixed min-w-[720px]">
            <thead>
              <tr className="h-11 border-b border-border text-left text-muted-foreground">
                <th className="font-medium px-3 w-[44%]">Name</th>
                <th className="font-medium px-3 w-[14%]">Type</th>
                <th className="font-medium px-3 w-[14%] text-right">Size</th>
                <th className="font-medium px-3 w-[18%]">Last modified</th>
                <th className="font-medium px-3 w-[10%]"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {folders.map((folder) => (
                <tr key={folder.prefix} className="h-12 border-b border-border/70 hover:bg-muted/50">
                  <td className="px-3">
                    <button
                      className="flex items-center gap-3 min-w-0 max-w-full font-medium hover:underline"
                      onClick={() => { setPrefix(folder.prefix); setSearch("") }}
                    >
                      <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </button>
                  </td>
                  <td className="px-3 text-muted-foreground">Folder</td>
                  <td className="px-3 text-right text-muted-foreground">-</td>
                  <td className="px-3 text-muted-foreground">-</td>
                  <td className="px-3 text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${folder.name}`}
                            onClick={() => setDeleteTarget({
                              kind: "folder",
                              name: folder.name,
                              path: folder.prefix,
                            })}
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete folder</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                </tr>
              ))}
              {objects.map((object) => (
                <tr key={object.key} className="h-12 border-b border-border/70 hover:bg-muted/50">
                  <td className="px-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileArchive className="h-4 w-4 text-sky-600 shrink-0" />
                      <span className="truncate font-medium" title={object.key}>{object.name}</span>
                    </div>
                  </td>
                  <td className="px-3 text-muted-foreground">Object</td>
                  <td className="px-3 text-right tabular-nums">{formatFileSize(object.size)}</td>
                  <td className="px-3 text-muted-foreground">
                    {new Date(object.last_modified).toLocaleString()}
                  </td>
                  <td className="px-3 text-right">
                    <div className="flex items-center justify-end">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" asChild>
                              <a
                                href={storageDownloadUrl(object.key)}
                                download
                                aria-label={`Download ${object.name}`}
                              >
                                <Download />
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Download object</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${object.name}`}
                              onClick={() => setDeleteTarget({
                                kind: "object",
                                name: object.name,
                                path: object.key,
                              })}
                            >
                              <Trash2 className="text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete object</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-3" /> Loading objects
          </div>
        )}
        {!loading && error && (
          <div className="h-48 flex items-center justify-center text-destructive">{error}</div>
        )}
        {!loading && !error && folders.length === 0 && objects.length === 0 && (
          <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
            <Database className="h-8 w-8 mb-3" />
            <p>{search ? "No matching objects" : "This prefix is empty"}</p>
          </div>
        )}

        <footer className="h-12 flex items-center justify-between text-xs text-muted-foreground border-t border-border mt-2">
          <span>{folders.length} folders, {objects.length} objects</span>
          <span>{formatFileSize(totalBytes)} in this prefix</span>
        </footer>
      </main>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.kind === "folder" ? "folder" : "object"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>
              {deleteTarget?.kind === "folder"
                ? " and every object under this folder will be permanently deleted."
                : " will be permanently deleted."}
              {" This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default StorageBrowser
