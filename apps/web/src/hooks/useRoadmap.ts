import { useQuery } from '@tanstack/react-query';
import type { RoadmapPhaseDTO } from '@mll/shared';
import { useTranslation } from 'react-i18next';
import { fetchPublicJson } from '../lib/api/publicFetch';

export function useRoadmap() {
  const { i18n } = useTranslation();
  const locale = i18n.language || 'pt-BR';

  return useQuery({
    queryKey: ['roadmap', locale],
    queryFn: () =>
      fetchPublicJson<{ phases: RoadmapPhaseDTO[] }>(`/roadmap?locale=${encodeURIComponent(locale)}`),
    staleTime: 60_000,
  });
}
