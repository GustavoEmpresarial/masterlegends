import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryCache, MutationCache, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './hooks/useAuth';
import { AdminAuthProvider } from './hooks/useAdminAuth';
import { App } from './App';
import { CookieConsent } from './components/legal/CookieConsent';
import { GoogleAnalyticsProvider } from './components/analytics/GoogleAnalyticsProvider';
import { AppErrorBoundary } from './components/errors/AppErrorBoundary';
import { MaintenanceOverlay } from './components/maintenance/MaintenanceOverlay';
import { TabProvider } from './lib/telemetry/TabContext';
import { setupGlobalErrorHandlers } from './lib/telemetry/setupGlobalErrorHandlers';
import {
  reportMutationError,
  reportQueryError,
} from './lib/telemetry/reportClientError';
import './i18n';
import './styles/globals.css';
import './styles/gameSkin.css';

setupGlobalErrorHandlers();

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      reportQueryError(error, query.queryKey);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      reportMutationError(error, mutation.options.mutationKey);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AdminAuthProvider>
            <TabProvider>
              <GoogleAnalyticsProvider>
                <AppErrorBoundary>
                  <App />
                </AppErrorBoundary>
                <MaintenanceOverlay />
                <CookieConsent />
              </GoogleAnalyticsProvider>
            </TabProvider>
          </AdminAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
