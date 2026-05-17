import { useCallback, useEffect, useRef, useState } from 'react'
import { type P1EvidenceStatus, updateP1Evidence } from '@/lib/phase1Api'

type SavePayload = {
  status?: P1EvidenceStatus
  notes?: string | null
  documentNotes?: string | null
  documentLink?: string | null
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Auto-save queue for Phase 1 evidence fields.
 *
 * Rules (US-023):
 *   - Text fields (notes, documentNotes, documentLink): debounce 1 second
 *   - Dropdown fields (status): save immediately
 *
 * Exposes saveStatus: 'idle' | 'saving' | 'saved' | 'error' for the
 * header status indicator (US-023).
 */
export function useAutoSave(onSaved?: (itemId: string, data: SavePayload) => void) {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [hasPendingSaves, setHasPendingSaves] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const pendingCount = useRef(0)

  const inc = () => {
    pendingCount.current++
    setHasPendingSaves(true)
    setSaveStatus('saving')
  }

  const dec = (success: boolean) => {
    pendingCount.current = Math.max(0, pendingCount.current - 1)
    if (pendingCount.current === 0) {
      setHasPendingSaves(false)
      setSaveStatus(success ? 'saved' : 'error')
    }
  }

  const flush = useCallback(
    async (itemId: string, payload: SavePayload) => {
      try {
        await updateP1Evidence(itemId, payload)
        onSaved?.(itemId, payload)
        dec(true)
      } catch {
        dec(false)
      }
    },
    [onSaved],
  )

  /** Queue a text save (1 s debounce). */
  const queueText = useCallback(
    (itemId: string, payload: SavePayload) => {
      const existing = timers.current.get(itemId)
      if (existing) {
        clearTimeout(existing)
        pendingCount.current = Math.max(0, pendingCount.current - 1)
      }
      inc()
      const t = setTimeout(() => {
        timers.current.delete(itemId)
        flush(itemId, payload)
      }, 1000)
      timers.current.set(itemId, t)
    },
    [flush],
  )

  /** Save a dropdown change immediately (no debounce). */
  const saveImmediate = useCallback(
    (itemId: string, payload: SavePayload) => {
      const existing = timers.current.get(itemId)
      if (existing) {
        clearTimeout(existing)
        timers.current.delete(itemId)
        pendingCount.current = Math.max(0, pendingCount.current - 1)
      }
      inc()
      flush(itemId, payload)
    },
    [flush],
  )

  useEffect(() => {
    return () => { timers.current.forEach((t) => clearTimeout(t)) }
  }, [])

  return { queueText, saveImmediate, hasPendingSaves, saveStatus }
}
