import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {
  applyTheme,
  resolveInitialTheme,
  ThemeProvider,
} from './components/useTheme.tsx'
import { I18nProvider, resolveInitialLocale } from './i18n.tsx'

applyTheme(resolveInitialTheme())
const initialLocale = resolveInitialLocale()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider locale={initialLocale}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
)
