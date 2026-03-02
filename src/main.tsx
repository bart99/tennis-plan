import React from 'react'
import ReactDOM from 'react-dom/client'
import TennisPlan from './components/TennisPlan'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TennisPlan />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) reg.update()
  })
}
