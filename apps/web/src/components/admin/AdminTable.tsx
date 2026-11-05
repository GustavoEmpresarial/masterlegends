import type { ReactNode } from 'react';
import { adminPt } from '../../lib/admin/i18n';

export interface AdminTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  loading?: boolean;
}

export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = adminPt.noRecords,
  loading,
}: AdminTableProps<T>) {
  if (loading) {
    return (
      <div className="admin-card flex items-center justify-center py-12">
        <p className="text-sm text-slate-400">{adminPt.loading}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="admin-card flex items-center justify-center py-12">
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="admin-card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.02]"
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-slate-200 ${col.className ?? ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminBadge({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const colors = {
    default: 'bg-white/[0.08] text-slate-200 border-white/[0.08]',
    success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    warning: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    danger: 'bg-red-500/15 text-red-300 border-red-500/25',
    info: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[variant]}`}
    >
      {children}
    </span>
  );
}

export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function AdminCard({
  children,
  className = '',
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div className={`admin-card ${padding ? 'p-5' : ''} ${className}`}>{children}</div>
  );
}

export function AdminStatCard({
  label,
  value,
  icon,
  accent = 'emerald',
}: {
  label: string;
  value: ReactNode;
  icon?: string;
  accent?: 'emerald' | 'amber' | 'sky' | 'rose';
}) {
  const accents = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };
  return (
    <div className="admin-card group p-5 transition-colors hover:border-white/[0.12]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {icon && (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${accents[accent]}`}
          >
            <i className={`bi ${icon} text-sm`} aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  );
}

export function AdminButton({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
}) {
  const variants = {
    primary:
      'bg-emerald-600 text-white hover:bg-emerald-500 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]',
    secondary: 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.08] border border-white/[0.08]',
    danger: 'bg-red-600/90 text-white hover:bg-red-500 border border-red-500/40',
    ghost: 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] border border-transparent',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2 text-sm rounded-lg',
  };
  return (
    <button
      type={type}
      data-variant={variant}
      className={`admin-button inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminInput({
  className = '',
  autoComplete,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      autoComplete={autoComplete ?? 'off'}
      data-lpignore="true"
      data-1p-ignore="true"
      data-form-type="other"
      className={`admin-input w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 transition-colors focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}

export function AdminModal({
  open,
  title,
  children,
  onClose,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        className={`game-surface relative w-full rounded-2xl border border-white/[0.08] bg-[#0c1220] shadow-2xl shadow-black/50 ${
          wide ? 'max-w-2xl max-h-[90vh] overflow-y-auto' : 'max-w-md'
        }`}
      >
        <div className="admin-modal-heading sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0c1220] px-5 py-4">
          <h2 className="font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Fechar"
          >
            <i className="bi bi-x-lg text-sm" aria-hidden />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && (
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-white/[0.06] bg-[#0c1220] px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
