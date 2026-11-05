import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportReactError } from '../../lib/telemetry/reportClientError';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportReactError(error, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-[40vh] flex items-center justify-center p-8">
          <div className="max-w-md w-full rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center space-y-4">
            <div className="text-3xl"><i className="bi bi-exclamation-triangle-fill" aria-hidden /></div>
            <h2 className="text-lg font-semibold text-white">
              {this.props.fallbackTitle ?? 'Algo deu errado'}
            </h2>
            <p className="text-sm text-slate-400">
              Ocorreu um erro inesperado nesta página. Tente recarregar ou voltar em instantes.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
              >
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:text-white text-sm"
              >
                Recarregar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
