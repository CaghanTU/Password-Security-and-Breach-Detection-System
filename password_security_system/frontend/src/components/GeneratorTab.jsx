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
  const totalLen = opts.length  // total including prefix+suffix shown to user
  const mandatoryConflict = (opts.min_digits + opts.min_symbols) > coreLen

  return (
    <div className="card p-4" style={{ maxWidth: 560 }}>
      <h5 className="mb-4">Güvenli Şifre Üret</h5>

      {/* Uzunluk */}
      <div className="mb-3">
        <label className="form-label d-flex justify-content-between">
          <span>Rastgele bölüm uzunluğu</span>
          <strong>
            {opts.length} karakter
            {(prefixLen || suffixLen) ? ` (core: ${coreLen}, toplam: ${prefixLen + coreLen + suffixLen})` : ''}
          </strong>
        </label>
        <input type="range" className="form-range" min={4} max={128} value={opts.length}
          onChange={e => set('length')(+e.target.value)} />
      </div>

      {/* Karakter seti */}
      <div className="row mb-2">
        {[
          ['use_upper', 'Büyük Harf (A-Z)'],
          ['use_lower', 'Küçük Harf (a-z)'],
          ['use_digits', 'Rakam (0-9)'],
          ['use_symbols', 'Sembol (!@#...)'],
        ].map(([k, label]) => (
          <div className="col-6 form-check ms-2 mb-1" key={k}>
            <input className="form-check-input" type="checkbox" id={k}
              checked={opts[k]} onChange={() => toggle(k)} />
            <label className="form-check-label" htmlFor={k}>{label}</label>
          </div>
        ))}
      </div>

      {/* Gelişmiş seçenekler toggle */}
      <button
        className="btn btn-sm btn-outline-secondary mb-3"
        onClick={() => setShowAdvanced(v => !v)}
      >
        {showAdvanced ? '▲ Gelişmiş Seçenekleri Gizle' : '▼ Gelişmiş Seçenekler'}
      </button>

      {showAdvanced && (
        <div className="border rounded p-3 mb-3" style={{ borderColor: '#4a5080', background: '#1e2130' }}>
          {/* Min rakam / sembol */}
          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label small">Min. Rakam Sayısı: <strong>{opts.min_digits}</strong></label>
              <input type="range" className="form-range" min={0} max={Math.min(20, opts.length)}
                value={opts.min_digits}
                onChange={e => set('min_digits')(+e.target.value)} />
            </div>
            <div className="col-6">
              <label className="form-label small">Min. Sembol Sayısı: <strong>{opts.min_symbols}</strong></label>
              <input type="range" className="form-range" min={0} max={Math.min(20, opts.length)}
                value={opts.min_symbols}
                onChange={e => set('min_symbols')(+e.target.value)} />
            </div>
          </div>

          {/* Önek / Sonek */}
          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label small">Önek (prefix)</label>
              <input className="form-control form-control-sm" placeholder="örn: MyApp-"
                value={opts.prefix} maxLength={32}
                onChange={e => set('prefix')(e.target.value)} />
            </div>
            <div className="col-6">
              <label className="form-label small">Sonek (suffix)</label>
              <input className="form-control form-control-sm" placeholder="örn: -2026"
                value={opts.suffix} maxLength={32}
                onChange={e => set('suffix')(e.target.value)} />
            </div>
          </div>

          {/* Özel karakterler */}
          <div className="mb-2">
            <label className="form-label small">Ekstra karakterler (alfabeye eklenir)</label>
            <input className="form-control form-control-sm" placeholder="örn: ₺€£ veya özel semboller"
              value={opts.custom_chars} maxLength={64}
              onChange={e => set('custom_chars')(e.target.value)} />
          </div>
        </div>
      )}

      <button className="btn btn-success w-100" onClick={generate} disabled={loading}>
        {loading ? <span className="spinner-border spinner-border-sm" /> : '⚡ Üret'}
      </button>

      {mandatoryConflict && (
        <div className="alert alert-warning py-2 mt-2 small">
          ⚠ Min. rakam + sembol ({opts.min_digits + opts.min_symbols}) core uzunluğunu ({coreLen}) aşıyor.
          Oranlar otomatik küçültülecek; büyük/küçük harf için de yer bırakılacak.
        </div>
      )}

      {error && <div className="alert alert-danger mt-3 py-2">{error}</div>}

      {result && (
        <div className="mt-4">
          <div
            className="p-3 rounded fw-bold font-monospace"
            style={{ background: '#0a0c12', cursor: 'pointer', wordBreak: 'break-all', fontSize: '1rem', color: '#4ade80' }}
            onClick={copy}
            title="Kopyalamak için tıkla"
          >
            {result.password}
          </div>
          <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
            <span className={`badge text-bg-${strengthColor[result.strength_label]}`}>{result.strength_label}</span>
            <small className="text-secondary">Entropi: <strong>{result.entropy_bits} bit</strong></small>
            <small className="text-secondary">Toplam uzunluk: <strong>{result.password.length}</strong></small>
            {copied && <span className="badge bg-info">✓ Kopyalandı!</span>}
          </div>
          <small className="text-muted">Şifreye tıklayarak panoya kopyala</small>
        </div>
      )}
    </div>
  )
}

