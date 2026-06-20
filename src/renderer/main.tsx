import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'
import { initCornerstone } from './cornerstone/init'
import { interceptConsole } from './logger'

interceptConsole()

initCornerstone().then(() => {
  // StrictMode intentionally omitted — double-invocation of effects destroys
  // Cornerstone3D's rendering engine before it finishes initialising.
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
})
