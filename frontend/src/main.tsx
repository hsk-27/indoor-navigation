import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { RouteProvider } from './context/RouteContext'
import { LocalizationProvider } from './context/LocalizationContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouteProvider>
      <LocalizationProvider>
        <App />
      </LocalizationProvider>
    </RouteProvider>
  </React.StrictMode>,
)
