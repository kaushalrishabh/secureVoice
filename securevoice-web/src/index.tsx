import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

// Sync auth store with token on startup
import { useAuthStore } from './store/authStore';
const { user, clearUser } = useAuthStore.getState();
if (user && !localStorage.getItem('sv_token')) clearUser();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#18181B',
            color: '#FAFAFA',
            border: '0.5px solid rgba(255,255,255,0.08)',
            fontSize: '13px',
            fontFamily: 'Outfit, sans-serif',
            borderRadius: '10px',
          },
          success: { iconTheme: { primary: '#22C55E', secondary: '#18181B' } },
          error:   { iconTheme: { primary: '#EF4444', secondary: '#18181B' } },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
);