import { QueryClient, useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { api, ApiError } from './client';
import type { Me } from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (n, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && n < 2,
      retryDelay: n => Math.min(4000, 500 * 2 ** n),
    },
  },
});

/** GET a JSON endpoint; the path is the query key. */
export function useApi<T>(path: string | null, opts?: Partial<UseQueryOptions<T, ApiError>>) {
  return useQuery<T, ApiError>({ queryKey: [path], queryFn: () => api.get<T>(path!), enabled: !!path, ...opts });
}

export function useMe() {
  return useQuery<Me | null, ApiError>({
    queryKey: ['/api/me'],
    queryFn: async () => {
      try { return await api.get<Me>('/api/me'); } catch (e) { if (e instanceof ApiError && e.status === 401) return null; throw e; }
    },
    staleTime: 30_000,
  });
}

export function useRefreshMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['/api/me'] });
}

export function useApiMutation<TBody, TRes>(fn: (b: TBody) => Promise<TRes>, invalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation<TRes, ApiError, TBody>({
    mutationFn: fn,
    onSuccess: () => invalidate.forEach(k => qc.invalidateQueries({ queryKey: [k] })),
  });
}
