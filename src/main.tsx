import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { registerSW } from 'virtual:pwa-register';
import { initTabBarAutoScroll } from './utils/tabBarAutoScroll.ts';
import { initColorTheme } from './utils/colorTheme.ts';
import { initSalaryIncomeSyncPrompt } from './utils/salaryIncomeSyncPrompt.ts';
import './index.css';

initColorTheme();
initTabBarAutoScroll();
initSalaryIncomeSyncPrompt();

// Register PWA service worker with automatic update detection
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[SisFinz PWA] App pronto para uso offline.');
  },
});

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event?.data;
    if (data && data.type === 'FINZY_REMINDER_PUSH') {
      window.dispatchEvent(
        new CustomEvent('sisfinz:finzy-reminder-push', { detail: data.payload || null })
      );
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
);
