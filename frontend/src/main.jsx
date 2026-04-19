import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/config'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'

try {
  const stored = localStorage.getItem('disaster-app-theme')
  if (stored === 'light' || stored === 'dark') {
    document.documentElement.setAttribute('data-theme', stored)
  } else {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
} catch {
  document.documentElement.setAttribute('data-theme', 'dark')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
