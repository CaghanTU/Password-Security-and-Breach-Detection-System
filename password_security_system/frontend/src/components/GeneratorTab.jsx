import { useState } from 'react'
import { api } from '../services/api'

export default function GeneratorTab() {
  const [opts, setOpts] = useState({
    length: 16,
    use_upper: true,
    use_lower: true,
    use_digits: true,
    use_symbols: true,
    min_digits: 0,
    min_symbols: 0,
    prefix: '',
    suffix: '',
    custom_chars: '',
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const set = k => v => setOpts(o => ({ ...o, [k]: v }))
  const toggle = k => setOpts(o => ({ ...o, [k]: !o[k] }))

  async function generate() {
    setError(''); setLoading(true); setCopied(false)
    try { setResult(await api.generate(opts)) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  function copy() {
    navigator.clipboard.writeText(result.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const strengthColor = { weak: 'danger', medium: 'warning', strong: 'success' }
  const prefixLen = opts.prefix.length
  const suffixLen = opts.suffix.length
  const coreLen = Math.max(0, opts.length - prefixLen - suffixLen)
  const totalLen = opts.length
  const mandatoryConflict = (opts.min_digits + opts.min_symbols) > coreLen

  return (
    <div className="card p-4" style={{ maxWidth: 560 }}>
      <h5 className="mb-4">Secure Password Generator</h5>

      {/* Length */}
      <div className="mb-3">
        <label className="form-label d-flex justify-content-between">
          <span>Random portion length</span>
          <strong>
            {opts.length} characters
            {(prefixLen || suffixLen) ? ` (core: ${coreLen}, total: ${prefixLen + coreLen + suffixLen})` : ''}
          </strong>
        </label>
        <input type="range" className="form-range" min={4} max={128} value={opts.length}
          onChange={e => set('length')(+e.target.value)} />
      </div>

      {/* Character set */}
      <div className="row mb-2">
        {[
          ['use_upper', 'Uppercase (A-Z)'],
          ['use_lower', 'Lowercase (a-z)'],
          ['use_digits', 'Digits (0-9)'],
          ['use_symbols', 'Symbols (!@#...)'],
        ].map(([k, label]) => (
          <div className="col-6 form-check ms-2 mb-1" key={k}>
            <input className="form-check-input" type="checkbox" id={k}
              checked={opts[k]} onChange={() => toggle(k)} />
            <label className="form-check-label" htmlFor={k}>{label}</label>
          </div>
        ))}
      </div>

      {/* Advanced options toggle */}
      <button
        className="btn btn-sm btn-outline-secondary mb-3"
        onClick={() => setShowAdvanced(v => !v)}
      >
        {showAdvanced ? '▲ Hide Advanced Options' : '▼ Advanced Options'}
      </button>

      {showAdvanced && (
        <div className="border rounded p-3 mb-3" style={{ borderColor: '#4a5080', background: '#1e2130' }}>
          {/* Min digits / symbols */}
          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label small">Min. Digits: <strong>{opts.min_digits}</strong></label>
              <input type="range" className="form-range" min={0} max={Math.min(20, opts.length)}
                value={opts.min_digits}
                onChange={e => set('min_digits')(+e.target.value)} />
            </div>
            <div className="col-6">
              <label className="form-label small">Min. Symbols: <strong>{opts.min_symbols}</strong></label>
              <input type="range" className="form-range" min={0} max={Math.min(20, opts.length)}
                value={opts.min_symbols}
                onChange={e => set('min_symbols')(+e.target.value)} />
            </div>
          </div>

          {/* Prefix / Suffix */}
          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label small">Prefix</label>
              <input className="form-control form-control-sm" placeholder="e.g. MyApp-"
                value={opts.prefix} maxLength={32}
                onChange={e => set('prefix')(e.target.value)} />
            </div>
            <div className="col-6">
              <label className="form-label small">Suffix</label>
              <input className="form-control form-control-sm" placeholder="e.g. -2026"
                value={opts.suffix} maxLength={32}
                onChange={e => set('suffix')(e.target.value)} />
            </div>
          </div>

          {/* Custom characters */}
          <div className="mb-2">
            <label className="form-label small">Extra characters (added to alphabet)</label>
            <input className="form-control form-control-sm" placeholder="e.g. special symbols"
              value={opts.custom_chars} maxLength={64}
              onChange={e => set('custom_chars')(e.target.value)} />
          </div>
        </div>
      )}

      <button className="btn btn-success w-100" onClick={generate} disabled={loading}>
        {loading ? <span className="spinner-border spinner-border-sm" /> : 'Generate'}
      </button>

      {mandatoryConflict && (
        <div className="alert alert-warning py-2 mt-2 small">
          Min. digits + symbols ({opts.min_digits + opts.min_symbols}) exceeds core length ({coreLen}).
          Ratios will be adjusted automatically.
        </div>
      )}

      {error && <div className="alert alert-danger mt-3 py-2">{error}</div>}

      {result && (
        <div className="mt-4">
          <div
            className="p-3 rounded fw-bold font-monospace"
            style={{ background: '#0a0c12', cursor: 'pointer', wordBreak: 'break-all', fontSize: '1rem', color: '#4ade80' }}
            onClick={copy}
            title="Click to copy"
          >
            {result.password}
          </div>
          <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
            <span className={`badge text-bg-${strengthColor[result.strength_label]}`}>{result.strength_label}</span>
            <small className="text-secondary">Entropy: <strong>{result.entropy_bits} bit</strong></small>
            <small className="text-secondary">Total length: <strong>{result.password.length}</strong></small>
            {copied && <span className="badge bg-info">Copied!</span>}
          </div>
          <small className="text-muted">Click the password to copy to clipboard</small>
        </div>
      )}
    </div>
  )
}
