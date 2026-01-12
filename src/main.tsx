import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// PatternFly styles - order matters!
import '@patternfly/react-core/dist/styles/base.css'
import '@patternfly/chatbot/dist/css/main.css'

import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
