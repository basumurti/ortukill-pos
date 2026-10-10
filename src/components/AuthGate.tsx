import React, { useCallback, useEffect, useState } from 'react';
import LoginView from './LoginView';

type Status = 'checking' | 'login' | 'setup' | 'authed';

/**
 * Menahan seluruh aplikasi di belakang login.
 * Selain memeriksa sesi saat halaman dibuka, komponen ini juga menangkap
 * respons 401 dari endpoint /api/* supaya sesi yang kedaluwarsa otomatis
 * kembali ke layar login.
 */
let interceptorInstalled = false;

function installUnauthorizedInterceptor() {
  if (interceptorInstalled || typeof window === 'undefined') return;
  interceptorInstalled = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await originalFetch(...args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
      if (response.status === 401 && url.includes('/api/') && !url.includes('/api/auth/')) {
        window.dispatchEvent(new Event('otk:unauthorized'));
      }
    } catch {
      /* abaikan: kegagalan di sini tidak boleh mengganggu request asli */
    }
    return response;
  };
}

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [status, setStatus] = useState<Status>('checking');

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'same-origin' });
      const data = await res.json();
      if (data?.authenticated) setStatus('authed');
      else if (data?.needsSetup) setStatus('setup');
      else setStatus('login');
    } catch {
      setStatus('login');
    }
  }, []);

  useEffect(() => {
    installUnauthorizedInterceptor();
    checkSession();
    const onUnauthorized = () => setStatus('login');
    window.addEventListener('otk:unauthorized', onUnauthorized);
    return () => window.removeEventListener('otk:unauthorized', onUnauthorized);
  }, [checkSession]);

  if (status === 'authed') return <>{children}</>;

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-[#EEF1F6] flex items-center justify-center">
        <span className="text-sm text-stone-400">Memeriksa sesi…</span>
      </div>
    );
  }

  return <LoginView mode={status === 'setup' ? 'setup' : 'login'} onSuccess={checkSession} />;
};

export default AuthGate;
