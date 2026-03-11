import { useEffect, useState } from 'react'
import { AlertTriangle, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NoticeToast() {
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    const onErr = (e) => {
      const detail = e?.detail || {}
      setNotice({
        action: detail.action || 'storage',
        message: detail.message || 'Couldn’t save on this device.',
        ts: Date.now(),
      })
    }
    window.addEventListener('birdie-bank:storage-error', onErr)
    return () => window.removeEventListener('birdie-bank:storage-error', onErr)
  }, [])

  if (!notice) return null

  const canRetry = notice.action === 'saveRound'

  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      <div className="toast">
        <div className="toast-ic">
          <AlertTriangle size={16} />
        </div>
        <div className="toast-body">
          <div className="toast-title">Couldn’t save</div>
          <div className="toast-sub">Your changes may not be saved on this device.</div>
        </div>
        <div className="toast-actions">
          {canRetry && (
            <Button
              type="button"
              className="toast-btn"
              onClick={() => window.location.reload()}
              aria-label="Retry"
              title="Retry"
            >
              <RotateCcw size={16} />
            </Button>
          )}
          <Button
            type="button"
            className="toast-btn"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            title="Dismiss"
          >
            <X size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}

