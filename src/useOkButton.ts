import { useEffect, useRef, useState } from 'react'
import { OK_HOLD_MS } from './medbox'

export type OkButton = {
  press: () => void
  release: () => void
  cancel: () => void
  pressed: boolean
}

export function useOkButton(onShort: () => void, onLong: () => void): OkButton {
  const [pressed, setPressed] = useState(false)
  const callbacks = useRef({ onShort, onLong })
  const started = useRef<number | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => { callbacks.current = { onShort, onLong } }, [onShort, onLong])

  function cancel() {
    window.clearTimeout(timer.current)
    timer.current = undefined
    started.current = null
    setPressed(false)
  }

  useEffect(() => {
    window.addEventListener('blur', cancel)
    return () => {
      window.removeEventListener('blur', cancel)
      window.clearTimeout(timer.current)
    }
  }, [])

  return {
    pressed,
    press() {
      if (started.current !== null) return
      started.current = performance.now()
      setPressed(true)
      timer.current = window.setTimeout(() => {
        timer.current = undefined
        callbacks.current.onLong()
      }, OK_HOLD_MS)
    },
    release() {
      if (started.current === null) return
      const waiting = timer.current !== undefined
      const elapsed = performance.now() - started.current
      cancel()
      if (waiting) {
        if (elapsed >= OK_HOLD_MS) callbacks.current.onLong()
        else callbacks.current.onShort()
      }
    },
    cancel,
  }
}
