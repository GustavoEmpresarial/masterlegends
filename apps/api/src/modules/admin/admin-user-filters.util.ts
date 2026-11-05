import type { Prisma } from '@prisma/client';
import { ADMIN_DISABLE_LOCK_UNTIL } from './user-account.util.js';

export interface AdminUserListFilters {
  search?: string;
  banned?: boolean;
  disabled?: boolean;
  walletLinked?: boolean;
  emailVerified?: boolean;
  hasClub?: boolean;
  depositor?: boolean;
  openTickets?: boolean;
  pendingWithdrawal?: boolean;
  referred?: boolean;
}

export const DEPOSITOR_OR: Prisma.UserWhereInput = {
  OR: [
    { depositClaims: { some: { status: 'credited' } } },
    { walletTransactions: { some: { type: 'usdc_deposit' } } },
    { mgtTransactions: { some: { type: 'usdc_deposit' } } },
  ],
};

export function buildAdminUserWhere(filters: AdminUserListFilters): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];

  if (filters.banned === true) and.push({ bannedAt: { not: null } });
  if (filters.banned === false) and.push({ bannedAt: null });

  if (filters.disabled === true) {
    and.push({ lockedUntil: { gte: ADMIN_DISABLE_LOCK_UNTIL } });
  }
  if (filters.disabled === false) {
    and.push({
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: ADMIN_DISABLE_LOCK_UNTIL } }],
    });
  }

  if (filters.walletLinked === true) and.push({ wallet: { not: null } });
  if (filters.walletLinked === false) and.push({ wallet: null });

  if (filters.emailVerified === true) and.push({ emailVerifiedAt: { not: null } });
  if (filters.emailVerified === false) and.push({ emailVerifiedAt: null });

  if (filters.hasClub === true) and.push({ club: { isNot: null } });
  if (filters.hasClub === false) and.push({ club: null });

  if (filters.depositor === true) and.push(DEPOSITOR_OR);
  if (filters.depositor === false) and.push({ NOT: DEPOSITOR_OR });

  if (filters.openTickets === true) {
    and.push({ supportTickets: { some: { status: { in: ['open', 'in_progress'] } } } });
  }
  if (filters.openTickets === false) {
    and.push({ supportTickets: { none: { status: { in: ['open', 'in_progress'] } } } });
  }

  if (filters.pendingWithdrawal === true) {
    and.push({ withdrawalRequests: { some: { status: 'pending' } } });
  }
  if (filters.pendingWithdrawal === false) {
    and.push({ withdrawalRequests: { none: { status: 'pending' } } });
  }

  if (filters.referred === true) and.push({ referredBy: { not: null } });
  if (filters.referred === false) and.push({ referredBy: null });

  const search = filters.search?.trim();
  if (search) {
    const or: Prisma.UserWhereInput[] = [
      { email: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
      { wallet: { contains: search, mode: 'insensitive' } },
      { referralCode: { contains: search, mode: 'insensitive' } },
      { club: { name: { contains: search, mode: 'insensitive' } } },
    ];
    if (search.length >= 8) {
      or.unshift({ id: { startsWith: search, mode: 'insensitive' } });
    }
    and.push({ OR: or });
  }

  return and.length > 0 ? { AND: and } : {};
}

export function parseTriStateParam(value: string | undefined): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export function parseAdminUserListFilters(query: Record<string, string | undefined>): AdminUserListFilters {
  return {
    search: query.search,
    banned: parseTriStateParam(query.banned),
    disabled: parseTriStateParam(query.disabled),
    walletLinked: parseTriStateParam(query.walletLinked),
    emailVerified: parseTriStateParam(query.emailVerified),
    hasClub: parseTriStateParam(query.hasClub),
    depositor: parseTriStateParam(query.depositor),
    openTickets: parseTriStateParam(query.openTickets),
    pendingWithdrawal: parseTriStateParam(query.pendingWithdrawal),
    referred: parseTriStateParam(query.referred),
  };
}
