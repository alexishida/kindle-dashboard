export function ReqChip({ ok, label, desc }: { ok: boolean; label: string; desc: string }): React.JSX.Element {
  return (
    <div className={`req-chip ${ok ? 'ok' : 'bad'}`}>
      <span className="req-icon" aria-hidden="true">{ok ? '✓' : '✕'}</span>
      <span className="req-body">
        <span className="req-label">{label}</span>
        <span className="req-desc">{desc}</span>
      </span>
    </div>
  )
}

export function ExecPill({ ok, label, value }: { ok: boolean; label: string; value: string }): React.JSX.Element {
  return (
    <div className={`exec-pill ${ok ? 'ok' : 'bad'}`}>
      <span className="exec-dot" aria-hidden="true" />
      <span className="exec-label">{label}</span>
      <span className="exec-value">{value}</span>
    </div>
  )
}
