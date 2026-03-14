import { useState, useEffect, useCallback } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Legend, Filler,
} from 'chart.js'
import { api } from '../services/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

function ScoreCircle({ score }) {
  const color = score >= 70 ? '#198754' : score >= 40 ? '#fd7e14' : '#dc3545'
  return (
    <div className="score-ring text-center" style={{ color }}>
      {score}
      <div className="fs-6 text-secondary fw-normal mt-1">/ 100</div>
    </div>
  )
}

export default function ScoreTab() {
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [scoreData, hist] = await Promise.all([api.getScore(), api.getScoreHistory()])
      setData(scoreData)
      setHistory(hist)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
  if (!data) return null

  const b = data.breakdown
  const chartData = {
    labels: history.map(h => new Date(h.calculated_at).toLocaleDateString()),
    datasets: [{
      label: 'Risk Score',
      data: history.map(h => h.score),
      borderColor: '#0d6efd',
      backgroundColor: 'rgba(13,110,253,0.12)',
      tension: 0.35,
      fill: true,
      pointRadius: 4,
    }],
  }
  const chartOpts = {
    responsive: true,
    scales: {
      y: { min: 0, max: 100, ticks: { color: '#adb5bd' }, grid: { color: '#2d3148' } },
      x: { ticks: { color: '#adb5bd' }, grid: { color: '#2d3148' } },
    },
    plugins: { legend: { labels: { color: '#adb5bd' } } },
  }

  return (
    <div className="row g-4">
      {/* Score + breakdown */}
      <div className="col-md-4">
        <div className="card p-4 h-100">
          <h5 className="mb-3">Current Score</h5>
          <ScoreCircle score={data.score} />

          <table className="table table-dark table-sm mt-4">
            <tbody>
              <tr><td>Total credentials</td><td>{b.total_credentials}</td></tr>
              <tr className={b.weak_count > 0 ? 'text-danger' : ''}>
                <td>Weak passwords</td><td>{b.weak_count} (-{5 * b.weak_count})</td>
              </tr>
              <tr className={b.reused_count > 0 ? 'text-warning' : ''}>
                <td>Reused passwords</td><td>{b.reused_count} (-{8 * b.reused_count})</td>
              </tr>
              <tr className={b.breached_count > 0 ? 'text-danger' : ''}>
                <td>Breached passwords</td><td>{b.breached_count} (-{15 * b.breached_count})</td>
              </tr>
              <tr className={b.email_breached_count > 0 ? 'text-danger' : ''}>
                <td>Breached emails</td><td>{b.email_breached_count} (-{10 * b.email_breached_count})</td>
              </tr>
              <tr className={b.stale_count > 0 ? 'text-warning' : ''}>
                <td>Stale (&gt;90 days)</td><td>{b.stale_count} (-{3 * b.stale_count})</td>
              </tr>
              <tr className={b.not_rotated_count > 0 ? 'text-danger' : ''}>
                <td>Not rotated after breach</td><td>{b.not_rotated_count} (-{5 * b.not_rotated_count})</td>
              </tr>
            </tbody>
          </table>

          <button className="btn btn-outline-info btn-sm w-100 mt-auto" onClick={load}>
            Recalculate
          </button>
        </div>
      </div>

      {/* History chart */}
      <div className="col-md-8">
        <div className="card p-4 h-100">
          <h5 className="mb-3">Score History</h5>
          {history.length < 2
            ? <p className="text-secondary">At least 2 measurements are needed for the chart.</p>
            : <Line data={chartData} options={chartOpts} />
          }
        </div>
      </div>
    </div>
  )
}
