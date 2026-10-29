import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getCitiesByState, getStates } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { getEnv } from '../../config/env';
import { useLocalStorage } from '../../hooks/useLocalStorage';

export interface SelectedLocation {
  uf: string;
  cityName: string;
  ibgeCode: string;
  lat: number;
  lng: number;
  /** Ex.: `"São Paulo, SP"` ou `"Localização atual"`. */
  label: string;
}

export const LOCATION_STORAGE_KEY = 'brchain.location';

export const DEFAULT_LOCATION: SelectedLocation = {
  uf: 'SP',
  cityName: 'São Paulo',
  ibgeCode: getEnv().VITE_DEFAULT_CITY_IBGE,
  lat: -23.5489,
  lng: -46.6388,
  label: 'São Paulo, SP',
};

function validateLocation(raw: unknown): SelectedLocation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.uf === 'string' &&
    typeof r.cityName === 'string' &&
    typeof r.ibgeCode === 'string' &&
    typeof r.lat === 'number' &&
    typeof r.lng === 'number' &&
    typeof r.label === 'string'
  ) {
    return r as unknown as SelectedLocation;
  }
  return null;
}

/**
 * Localização selecionada pelo usuário, persistida em `localStorage` (`brchain.location`).
 * Ao trocar de cidade, invalida as queries regionais (mapa, notícias, dashboard).
 */
export function useLocationSelection() {
  const queryClient = useQueryClient();
  const [location, setStored] = useLocalStorage<SelectedLocation>(
    LOCATION_STORAGE_KEY,
    DEFAULT_LOCATION,
    validateLocation,
  );

  const selectLocation = useCallback(
    (next: SelectedLocation) => {
      setStored(next);
      void queryClient.invalidateQueries({ queryKey: ['ubs'] });
      void queryClient.invalidateQueries({ queryKey: ['news'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    [queryClient, setStored],
  );

  return { location, selectLocation };
}

export function useStates() {
  return useQuery({
    queryKey: queryKeys.states,
    queryFn: ({ signal }) => getStates(signal),
    staleTime: 60 * 60_000,
  });
}

export function useCities(uf: string) {
  return useQuery({
    queryKey: queryKeys.cities(uf),
    queryFn: ({ signal }) => getCitiesByState(uf, signal),
    enabled: Boolean(uf),
    staleTime: 60 * 60_000,
  });
}
