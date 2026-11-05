import { useQuery } from '@tanstack/react-query';
import type { PublicStatsDTO } from '@mll/shared';
import { fetchPublicJson } from '../lib/api/publicFetch';

export function usePublicStats() {
  return useQuery({
    queryKey: ['public-stats'],
    queryFn: () => fetchPublicJson<PublicStatsDTO>('/stats/public'),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
