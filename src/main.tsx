import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App'
import HistoryPage from './HistoryPanel'
import AuthGate from './AuthGate'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthGate>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </AuthGate>
    </BrowserRouter>
  </React.StrictMode>,
)
