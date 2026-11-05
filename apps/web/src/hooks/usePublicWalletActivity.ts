import { useQuery } from '@tanstack/react-query';
import type { PublicWalletActivityDTO } from '@mll/shared';
import { fetchPublicJson } from '../lib/api/publicFetch';

export function usePublicWalletActivity() {
  return useQuery({
    queryKey: ['public-wallet-activity'],
    queryFn: () => fetchPublicJson<PublicWalletActivityDTO>('/stats/public/wallet-activity'),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
