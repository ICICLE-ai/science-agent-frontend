import React, { useEffect } from "react"
import { useState } from "react"
import { useTheme } from "@/providers/ThemeProvider"
import { OutputFile, outputFileUrl } from "../api/api"
import { formatFileSize, useLocalStorageState } from "@/lib/utils"
import { ImageIcon, Files, FileCode, Download, ChevronDown, Expand } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CsvViewer } from "@/components/CsvViewer"
import { ContentModal } from "./ContentModal"
import { ScrollArea, ScrollBar } from "./ui/scroll-area"

interface FileCardProps {
  file: OutputFile
}

export const FileCard: React.FC<FileCardProps> = ({ file }) => {
  const [expanded, setExpanded] = useLocalStorageState(`file_${file.id}`, false)
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [textLoading, setTextLoading] = useState(false)
  const [textError, setTextError] = useState<string | null>(null)
  const { theme } = useTheme()

  // Prevent card toggle when clicking on the download link
  const handleDownloadClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()

    // Create a temporary anchor element to trigger download
    const a = document.createElement("a")
    a.href = outputFileUrl(file)
    a.download = file.filename
    a.target = "_blank"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Fetch text content on demand and cache it
  const fetchTextIfNeeded = () => {
    if (!isText) return
    if (textContent !== null) return

    setTextLoading(true)
    setTextError(null)

    fetch(outputFileUrl(file))
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`)
        return res.text()
      })
      .then((text) => {
        setTextContent(text)
      })
      .catch((err) => {
        setTextError(err.message || String(err))
      })
      .finally(() => {
        setTextLoading(false)
      })
  }

  // Open modal when clicking on content
  const handleContentClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setModalOpen(true)
  }

  // Toggle expanded state with localStorage persistence
  const toggleExpanded = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const newExpanded = !expanded
    setExpanded(newExpanded)
  }

  useEffect(() => {
    if (isText && textContent == null) {
      fetchTextIfNeeded()
    }
  }, [expanded])

  // Check file extension in a case-insensitive manner
  const isCsv = file.filename.toLowerCase().endsWith(".csv")
  const isImage = /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(file.filename)
  const isText = /\.(txt|json|xml|toml|yaml|yml)$/i.test(file.filename)
  const fileIcon = isImage ? (
    <ImageIcon className="h-5 w-5" />
  ) : isCsv ? (
    <Files className="h-5 w-5" />
  ) : (
    <FileCode className="h-5 w-5" />
  )

  // Use the full filename and let CSS handle truncation
  const fullFilename = file.filename

  return (
    <>
      <Card className="h-full">
        <CardHeader className="p-3">
          <div className="flex justify-between items-center cursor-pointer select-none" onClick={toggleExpanded}>
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`
                  p-2 rounded-md flex-shrink-0
                  ${theme === "dark" ? "bg-muted/50" : "bg-muted"}
                `}
              >
                {fileIcon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-card-foreground truncate" title={fullFilename}>
                  {fullFilename}
                </p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleExpanded}>
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4 transform -rotate-90" />
                )}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownloadClick}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="p-0">
            {isCsv ? (
              <ScrollArea className="p-0 relative">
                <div className="max-h-60 w-full transition-opacity group">
                  <CsvViewer url={outputFileUrl(file)}/>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute bottom-2 right-2 h-10 w-10 bg-background opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      onClick={handleContentClick}
                    >
                      <Expand className="h-6 w-6" />
                    </Button>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            ) : isImage ? (
              <div
                className="p-3 flex flex-col items-center cursor-pointer hover:opacity-90 transition-opacity"
                onClick={handleContentClick}
              >
                <img
                  src={outputFileUrl(file) || "/placeholder.svg"}
                  alt={file.filename}
                  className="max-w-full max-h-60 object-contain rounded-md"
                />
              </div>
            ) : isText ? (
              <ScrollArea className="relative">
                <div
                  className="p-3 pt-0 rounded-md max-h-60 hover:opacity-90 transition-opacity group"
                >
                  {textLoading ? (
                    <p className="text-sm text-muted-foreground">Loading preview...</p>
                  ) : textError ? (
                    <p className="text-sm text-red-500">Error loading preview: {textError}</p>
                  ) : (
                    <pre className="whitespace-pre-wrap break-words text-sm font-mono">{textContent}</pre>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute bottom-2 right-2 h-10 w-10 bg-background opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={handleContentClick}
                  >
                    <Expand className="h-6 w-6" />
                  </Button>
                </div>
              </ScrollArea>
            ) : (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  Preview not available for this file type. Click the download button to view.
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Modal for fullscreen view */}
      <ContentModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={fullFilename}>
        {isCsv ? (
          <div className="h-full">
            <CsvViewer url={outputFileUrl(file)} />
          </div>
        ) : isImage ? (
          <div className="flex items-center justify-center h-full">
            <img
              src={outputFileUrl(file) || "/placeholder.svg"}
              alt={file.filename}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : isText ? (
          <div className="h-full p-4">
            {textLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : textError ? (
              <p className="text-sm text-red-500">Error loading file: {textError}</p>
            ) : (
              <pre className="whitespace-pre-wrap break-words text-sm font-mono">{textContent}</pre>
            )}
          </div>
        ) : null}
      </ContentModal>
    </>
  )
}