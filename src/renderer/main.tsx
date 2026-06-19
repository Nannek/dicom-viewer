import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'
import { initCornerstone } from './cornerstone/init'
import { interceptConsole } from './logger'

interceptConsole()

initCornerstone().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
