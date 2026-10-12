import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import '@fontsource-variable/manrope'
import './index.css'
import { applyTheme } from './theme/theme'

// resolve light/dark before first paint (no flash)
applyTheme()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
