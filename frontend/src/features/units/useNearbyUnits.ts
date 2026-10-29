import { useQuery } from '@tanstack/react-query';
import { getNearbyUnits } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';

export function useNearbyUnits(lat: number, lng: number, radiusKm = 10) {
  const params = { lat, lng, radius_km: radiusKm };
  return useQuery({
    queryKey: queryKeys.nearbyUnits(params),
    queryFn: ({ signal }) => getNearbyUnits(params, signal),
    staleTime: 2 * 60_000,
  });
}
