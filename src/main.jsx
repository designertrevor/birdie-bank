import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AppErrorBoundary } from './components/AppErrorBoundary'

if (import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')

try {
  createRoot(root).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>
  )
} catch (err) {
  console.error('Birdie Bank failed to mount:', err)
  root.innerHTML = ''
  const fallback = document.createElement('div')
  fallback.style.cssText = 'min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:#0d2818;color:#f0ece0;font-family:DM Sans,sans-serif;text-align:center;'
  fallback.innerHTML = '<h1 style="font-size:24px;margin-bottom:12px;color:#c8f04a">Something went wrong</h1><p style="font-size:14px;color:#7a9080;margin-bottom:24px">Refresh the page to try again. Check the console for details.</p><button type="button" onclick="location.reload()" style="padding:12px 24px;background:#c8f04a;color:#0f4225;border:none;border-radius:12px;font-weight:600;cursor:pointer">Reload</button>'
  root.appendChild(fallback)
}
