import { useQuery } from '@tanstack/react-query';
import { getNearbyUnits, type NearbyQuery } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';

/**
 * UBS próximas. Sem coordenadas (cidade escolhida na lista do IBGE), busca pelo
 * código IBGE do município e o back-end devolve as unidades da cidade, sem distância.
 */
export function useNearbyUnits(
  lat: number | null,
  lng: number | null,
  radiusKm = 10,
  cityIbge?: string,
) {
  const hasCoords = lat !== null && lng !== null;
  const params: NearbyQuery = hasCoords
    ? { lat, lng, radius_km: radiusKm, city_ibge: cityIbge }
    : { radius_km: radiusKm, city_ibge: cityIbge };
  return useQuery({
    queryKey: queryKeys.nearbyUnits(params),
    queryFn: ({ signal }) => getNearbyUnits(params, signal),
    enabled: hasCoords || Boolean(cityIbge),
    staleTime: 2 * 60_000,
  });
}
