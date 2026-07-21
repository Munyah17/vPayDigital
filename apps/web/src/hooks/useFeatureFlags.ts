import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';

// Unset flags default to enabled — Modules page only needs to store the
// features an admin has explicitly turned OFF.
export function useFeatureFlags() {
  const { data } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => api.get<{ success: boolean; data: Record<string, boolean> }>('/api/feature-flags'),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  const flags = data?.data?.data ?? {};
  return { isEnabled: (key: string) => flags[key] !== false };
}
