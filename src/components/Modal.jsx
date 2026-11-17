import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

// Bottom sheet on mobile, centered dialog on desktop.
export default function Modal({ open, onClose, title, subtitle, children, busy = false }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector('input,select,button:not([data-close])')?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose, busy])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />
      <div ref={panelRef}
        className="animate-rise relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-stone-200 sm:hidden" />
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
          </div>
          <button data-close onClick={onClose} disabled={busy} className="btn-ghost -mr-2 -mt-1 p-2" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
