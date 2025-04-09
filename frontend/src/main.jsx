import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import 'bootstrap/dist/css/bootstrap.min.css'

// Use dynamic require for compatibility with Vite
import { Buffer } from 'buffer'
import process from 'process'

window.Buffer = Buffer
window.process = process

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
