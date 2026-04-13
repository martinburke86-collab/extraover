'use client'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'
import { clx } from '@/lib/utils'

type ToastKind = 'success' | 'error' | 'warning'
interface Toast { id: string; kind: ToastKind; message: string }
interface ToastCtx { toast: (message: string, kind?: ToastKind) => void }

const Ctx = createContext<ToastCtx>({ toast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(p => [...p, { id, kind, message }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500)
  }, [])

  const dismiss = (id: string) => setToasts(p => p.filter(t => t.id !== id))

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={clx(
            'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto',
            'animate-in slide-in-from-right duration-200',
            t.kind === 'success' ? 'bg-[#004225] text-white' :
            t.kind === 'error'   ? 'bg-[#C00000] text-white' :
                                   'bg-[#FFC000] text-gray-900'
          )}>
            {t.kind === 'success' ? <CheckCircle size={15} /> :
             t.kind === 'error'   ? <XCircle     size={15} /> :
                                    <AlertCircle  size={15} />}
            <span>{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="ml-2 opacity-70 hover:opacity-100">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
