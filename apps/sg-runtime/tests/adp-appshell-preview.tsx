import React from 'react'
import {createRoot} from 'react-dom/client'
import {AppShellDashboard} from '../components/appshell/appshell-dashboard'

// Isolated browser acceptance only. No session is impersonated or supplied to APIs.
const locale = location.pathname.startsWith('/en/') ? 'en' : 'pl'
createRoot(document.getElementById('root')!).render(<AppShellDashboard locale={locale} assistantAvatar="male" salutation={locale === 'en' ? 'Jan' : 'Janie'} organisationBranding="porr" onLogout={() => {}} />)
