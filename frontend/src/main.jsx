import React from 'react'
import ReactDOM from 'react-dom'
import './i18n'
import App from './App.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import { installGlobalHandlers } from './logger'

installGlobalHandlers(); // window.onerror + unhandledrejection → лог

ReactDOM.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
  document.getElementById('root')
)
