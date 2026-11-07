import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { registerSW } from 'virtual:pwa-register';
import './index.css';

// Register PWA service worker with automatic update detection
if (import.meta.env.PROD) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
    },
    onRegisteredSW(swUrl, r) {
      if (r) {
        r.update();
        setInterval(() => {
          r.update();
        }, 15 * 60 * 1000);
      }
    },
  });
} else {
  // In development, unregister any lingering service workers from previous builds to prevent stale UI caching
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary fallbackTitle="Error al iniciar la aplicación">
    <AuthProvider>
      <App />
    </AuthProvider>
  </ErrorBoundary>
);
