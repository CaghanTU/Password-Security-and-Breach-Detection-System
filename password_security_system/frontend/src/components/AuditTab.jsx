import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import {
  Box, Typography, Button, Alert, CircularProgress, Chip, Stack,
  Grid, TextField, Paper, Collapse,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material'
import {
  Timeline, TimelineItem, TimelineSeparator, TimelineConnector,
  TimelineContent, TimelineDot, TimelineOppositeContent,
} from '@mui/lab'
import DeleteIcon from '@mui/icons-material/Delete'
import TableRowsIcon from '@mui/icons-material/TableRows'
import TimelineIcon from '@mui/icons-material/Timeline'

const ACTION_COLORS = {
  LOGIN: 'success', LOGIN_FAILED: 'error', LOGOUT: 'default',
  '2FA_ENABLED': 'info', CREDENTIAL_ADD: 'primary', CREDENTIAL_UPDATE: 'warning',
  CREDENTIAL_DELETE: 'error', BREACH_CHECK: 'info', EXPORT: 'default',
  LOGIN_RECOVERY_CODE: 'warning', RECOVERY_CODES_REGENERATED: 'info',
  AUDIT_CLEARED: 'error',
}

const ACTION_DOT_COLORS = {
  LOGIN: 'success', LOGIN_FAILED: 'error', LOGOUT: 'grey',
  '2FA_ENABLED': 'info', CREDENTIAL_ADD: 'primary', CREDENTIAL_UPDATE: 'warning',
  CREDENTIAL_DELETE: 'error', BREACH_CHECK: 'info', EXPORT: 'grey',
  LOGIN_RECOVERY_CODE: 'warning', RECOVERY_CODES_REGENERATED: 'info',
  AUDIT_CLEARED: 'error',
}

export default function AuditTab() {
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('table')   // 'table' | 'timeline'

  const [showDelete, setShowDelete] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [deleting, setDeleting]       = useState(false)
  const [deleteMsg, setDeleteMsg]     = useState(null)
  const [confirmAll, setConfirmAll]   = useState(false)

  const load = useCallback(async (p) => {
    setLoading(true)
    try { setData(await api.getAudit(p)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(page) }, [load, page])

  function changePage(delta) {
    const next = page + delta
    if (next < 1) return
    setPage(next)
  }

  async function handleDelete(all) {
    setDeleting(true); setDeleteMsg(null)
    try {
      const res = await api.deleteAudit(
        all ? '' : dateFrom,
        all ? '' : dateTo,
      )
      setDeleteMsg({ ok: true, text: `${res.deleted} records deleted.` })
      setPage(1)
      load(1)
    } catch (e) {
      setDeleteMsg({ ok: false, text: e.message })
    } finally {
      setDeleting(false)
      setConfirmAll(false)
    }
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h6">Audit Log</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant={viewMode === 'table' ? 'contained' : 'outlined'}
            size="small" startIcon={<TableRowsIcon />}
            onClick={() => setViewMode('table')}
          >Table</Button>
          <Button
            variant={viewMode === 'timeline' ? 'contained' : 'outlined'}
            size="small" startIcon={<TimelineIcon />}
            onClick={() => setViewMode('timeline')}
          >Timeline</Button>
          <Button
            variant="outlined"
            color={showDelete ? 'inherit' : 'error'}
            size="small"
            startIcon={showDelete ? null : <DeleteIcon />}
            onClick={() => { setShowDelete(v => !v); setDeleteMsg(null); setConfirmAll(false) }}
          >
            {showDelete ? '✕ Cancel' : 'Clear'}
          </Button>
        </Stack>
      </Stack>

      {/* Delete panel */}
      <Collapse in={showDelete}>
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderColor: 'error.dark' }}>
          <Typography fontWeight={600} color="error.main" mb={1}>Delete Records</Typography>
          <Grid container spacing={2} mb={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Start date" type="date"
                value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="End date" type="date"
                value={dateTo} onChange={e => setDateTo(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }} />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
            <Button variant="contained" color="error" size="small"
              disabled={deleting || (!dateFrom && !dateTo)}
              onClick={() => handleDelete(false)}
            >
              {deleting ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
              Delete Date Range
            </Button>
            {!confirmAll ? (
              <Button variant="outlined" color="error" size="small" onClick={() => setConfirmAll(true)}>
                Delete All
              </Button>
            ) : (
              <>
                <Typography variant="caption" color="error.main" alignSelf="center">Are you sure?</Typography>
                <Button variant="contained" color="error" size="small" disabled={deleting} onClick={() => handleDelete(true)}>
                  {deleting ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                  Yes, Delete All
                </Button>
                <Button variant="outlined" size="small" onClick={() => setConfirmAll(false)}>No</Button>
              </>
            )}
          </Stack>
          {deleteMsg && (
            <Alert severity={deleteMsg.ok ? 'success' : 'error'} sx={{ mt: 2 }}>
              {deleteMsg.text}
            </Alert>
          )}
        </Paper>
      </Collapse>

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 5 }}><CircularProgress /></Box>
      ) : !data || !data.items.length ? (
        <Typography color="text.secondary">No records yet.</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" mb={1}>
            Page {data.page} — Total {data.total} records
          </Typography>

          {viewMode === 'table' ? (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date / Time</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>IP Address</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.items.map(e => (
                      <TableRow key={e.id} hover>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(e.created_at).toLocaleString('en-US')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={e.action} size="small" color={ACTION_COLORS[e.action] ?? 'default'} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            {e.ip_address ?? '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : (
            <Timeline position="right">
              {data.items.map((e, idx) => (
                <TimelineItem key={e.id}>
                  <TimelineOppositeContent sx={{ flex: 0.25, fontSize: '0.75rem', color: 'text.secondary', py: 1.5 }}>
                    {new Date(e.created_at).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                  </TimelineOppositeContent>
                  <TimelineSeparator>
                    <TimelineDot color={ACTION_DOT_COLORS[e.action] ?? 'grey'} sx={{ my: 1 }} />
                    {idx < data.items.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  <TimelineContent sx={{ py: 1.5 }}>
                    <Chip label={e.action} size="small" color={ACTION_COLORS[e.action] ?? 'default'} />
                    {e.ip_address && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontFamily: 'monospace' }}>
                        {e.ip_address}
                      </Typography>
                    )}
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          )}

          <Stack direction="row" spacing={1} mt={2}>
            <Button variant="outlined" size="small" onClick={() => changePage(-1)} disabled={page <= 1}>
              ← Previous
            </Button>
            <Button variant="outlined" size="small" onClick={() => changePage(1)} disabled={data.items.length < 20}>
              Next →
            </Button>
          </Stack>
        </>
      )}
    </Box>
  )
}
