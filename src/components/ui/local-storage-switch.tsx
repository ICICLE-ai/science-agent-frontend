"use client"

import React, { useState, useEffect } from "react"
import { HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"

interface LocalStorageSwitchProps {
  storageKey: string
  label?: string
  defaultValue?: boolean
  help?: string
  onChange?: (value: boolean) => void
}

export function LocalStorageSwitch({
  storageKey,
  label,
  defaultValue = false,
  help,
  onChange,
}: LocalStorageSwitchProps) {
  // Initialize from localStorage synchronously so the first render uses persisted value
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved !== null ? saved === "true" : !!defaultValue
    } catch {
      return !!defaultValue
    }
  })

  // Save to localStorage whenever value changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(enabled))
    } catch {
      // ignore storage errors (quota/denied)
    }
  }, [storageKey, enabled])

  // Notify parent once on mount with the initial loaded value
  useEffect(() => {
    onChange?.(enabled)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (newValue: boolean) => {
    setEnabled(newValue)
    onChange?.(newValue)
  }

  return (
    <div className="flex items-center space-x-2">
      <Switch
        id={storageKey}
        checked={enabled}
        onCheckedChange={handleChange}
      />
      {label && (
        <Label htmlFor={storageKey} className="mb-2 flex items-center gap-2">
          {label}
          {help && (
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{help}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </Label>
      )} 
    </div>
  )
}