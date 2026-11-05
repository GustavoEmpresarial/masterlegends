export type TriState = 'all' | 'yes' | 'no';

export interface AdminUserFilterState {
  search: string;
  banned: TriState;
  disabled: TriState;
  walletLinked: TriState;
  emailVerified: TriState;
  hasClub: TriState;
  depositor: TriState;
  openTickets: TriState;
  pendingWithdrawal: TriState;
  referred: TriState;
}

export const DEFAULT_USER_FILTERS: AdminUserFilterState = {
  search: '',
  banned: 'all',
  disabled: 'all',
  walletLinked: 'all',
  emailVerified: 'all',
  hasClub: 'all',
  depositor: 'all',
  openTickets: 'all',
  pendingWithdrawal: 'all',
  referred: 'all',
};

function triToParam(key: string, value: TriState, out: Record<string, string>) {
  if (value === 'yes') out[key] = 'true';
  if (value === 'no') out[key] = 'false';
}

export function userFiltersToQuery(filters: AdminUserFilterState): Record<string, string> {
  const params: Record<string, string> = {};
  const q = filters.search.trim();
  if (q) params.search = q;
  triToParam('banned', filters.banned, params);
  triToParam('disabled', filters.disabled, params);
  triToParam('walletLinked', filters.walletLinked, params);
  triToParam('emailVerified', filters.emailVerified, params);
  triToParam('hasClub', filters.hasClub, params);
  triToParam('depositor', filters.depositor, params);
  triToParam('openTickets', filters.openTickets, params);
  triToParam('pendingWithdrawal', filters.pendingWithdrawal, params);
  triToParam('referred', filters.referred, params);
  return params;
}

export function countActiveUserFilters(filters: AdminUserFilterState): number {
  let n = 0;
  const keys = Object.keys(DEFAULT_USER_FILTERS) as (keyof AdminUserFilterState)[];
  for (const key of keys) {
    if (key === 'search') {
      if (filters.search.trim()) n += 1;
    } else if (filters[key] !== 'all') {
      n += 1;
    }
  }
  return n;
}
