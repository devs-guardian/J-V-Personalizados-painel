import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

export function Pill({ kind, children }: { kind: 'ok' | 'in' | 'wa' | 'dg' | 'ac' | 'mu'; children: ReactNode }) {
  return <span className={`pill ${kind}`}>{children}</span>
}

const STATUS_KIND: Record<string, 'ok' | 'in' | 'wa' | 'dg' | 'ac' | 'mu'> = {
  novo: 'wa', producao: 'in', pronto: 'ok', enviado: 'ac', cancelado: 'dg',
}
const STATUS_TXT: Record<string, string> = { novo: 'Novo', producao: 'Em produção', pronto: 'Pronto', enviado: 'Enviado', cancelado: 'Cancelado' }
export const StatusPill = ({ status }: { status: string }) => <Pill kind={STATUS_KIND[status] ?? 'mu'}>{STATUS_TXT[status] ?? status}</Pill>

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`card ${className}`} style={style}>{children}</div>
}

export function Head({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="head">
      <div>
        <h1>{title}</h1>
        {sub && <div className="mu" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
      <div className="row">{children}</div>
    </div>
  )
}

export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="f">{label}{children}</label>
}

export function NumInput({ value, onChange, step = 'any', min }: { value: number | string; onChange: (v: string) => void; step?: string; min?: number }) {
  return <input className="i" type="number" step={step} min={min} value={value} onChange={(e) => onChange(e.target.value)} />
}

/** Modal com formulário: onSave lança Error para mostrar a mensagem sem fechar. */
export function Modal({
  title, children, onClose, onSave, saveLabel = 'Salvar', wide = false,
}: {
  title: string; children: ReactNode; onClose: () => void; onSave?: () => Promise<void> | void; saveLabel?: string; wide?: boolean
}) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!onSave) return onClose()
    setBusy(true); setErr('')
    try { await onSave(); onClose() } catch (x) { setErr((x as Error).message || 'Não foi possível salvar.'); setBusy(false) }
  }
  return (
    <div className="ov" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className={`md ${wide ? 'wide' : ''}`} onSubmit={submit} role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
        {err && <div className="err">{err}</div>}
        <div className="row" style={{ marginTop: 16 }}>
          <span className="sp" />
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          {onSave && <button className="btn pri" disabled={busy}>{busy ? 'Salvando…' : saveLabel}</button>}
        </div>
      </form>
    </div>
  )
}

let toastSetter: ((m: string) => void) | null = null
export const toast = (m: string) => toastSetter?.(m)
export function Toaster() {
  const [m, setM] = useState('')
  useEffect(() => { toastSetter = (x) => { setM(x); setTimeout(() => setM(''), 3200) }; return () => { toastSetter = null } }, [])
  return m ? <div className="toast">{m}</div> : null
}
