import {
  reportUnhandledRejection,
  reportWindowError,
} from './reportClientError';

export function setupGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    reportWindowError(
      event.message,
      event.filename,
      event.lineno,
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportUnhandledRejection(event.reason);
  });
}
