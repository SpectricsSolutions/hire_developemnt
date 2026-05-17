import { useCallback, useEffect, useRef, useState } from 'react'
import { type P1EvidenceStatus, updateP1Evidence } from '@/lib/phase1Api'

type SavePayload = { status?: P1EvidenceStatus; notes?: string | null }

/**
 * Auto-save queue for Phase 1 evidence fields.
 *
 * Rules (confirmed spec):
 *   - Text fields (notes): debounce 1 second before saving
 *   - Dropdown fields (status): save immediately
 *
 * Returns hasPendingSaves so the navigation guard can block unload.
 */
export function useAutoSave(onSaved?: (itemId: string, data: SavePayload) => void) {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [hasPendingSaves, setHasPendingSaves] = useState(false)
  const pendingCount = useRef(0)

  const inc = () => {
    pendingCount.current++
    setHasPendingSaves(true)
  }
  const dec = () => {
    pendingCount.current = Math.max(0, pendingCount.current - 1)
    if (pendingCount.current === 0) setHasPendingSaves(false)
  }

  const flush = useCallback(
    async (itemId: string, payload: SavePayload) => {
      try {
        await updateP1Evidence(itemId, payload)
        onSaved?.(itemId, payload)
      } catch {
        // Silently ignore — the UI shows dirty state; user can retry
      } finally {
        dec()
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
        dec()
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
      // Cancel any pending text save for this item so we don't double-save
      const existing = timers.current.get(itemId)
      if (existing) {
        clearTimeout(existing)
        timers.current.delete(itemId)
        dec()
      }
      inc()
      flush(itemId, payload)
    },
    [flush],
  )

  // Flush all pending timers on unmount
  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t))
    }
  }, [])

  return { queueText, saveImmediate, hasPendingSaves }
}
