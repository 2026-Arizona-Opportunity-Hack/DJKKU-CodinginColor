import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { loadStudentApi } from './features/student/loadApi'
import { env } from './lib/env'
import { installGlobalErrorHandlers, log } from './lib/log'
import { createQueryClient } from './lib/queryClient'
import './index.css'

installGlobalErrorHandlers()

const root = createRoot(document.getElementById('root')!)

loadStudentApi(env)
  .then((api) => {
    log.info('app.start', { dataSource: api.source, hints: env.hintsEnabled })
    root.render(
      <StrictMode>
        <App api={api} queryClient={createQueryClient()} />
      </StrictMode>,
    )
  })
  .catch((cause: unknown) => {
    log.error('app.start_fail', { cause })
    root.render(
      <main style={{ padding: 16, fontFamily: 'system-ui' }}>
        <h1>Coding in Color couldn't start</h1>
        <p>Reload the page. If it keeps happening, tell your instructor.</p>
      </main>,
    )
  })
