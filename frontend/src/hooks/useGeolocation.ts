import { useCallback, useState } from 'react';

export type GeoStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'unavailable';

export interface GeoCoords {
  lat: number;
  lng: number;
  accuracy: number;
}

/**
 * Geolocalização do navegador sob demanda (disparada por "Usar minha localização").
 * Se negada ou indisponível, nunca lança exceção: sinaliza `status = 'denied' | 'unavailable'`
 * para que a UI mostre o estado amigável pedindo seleção manual no topo.
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [coords, setCoords] = useState<GeoCoords | null>(null);

  const request = useCallback((onSuccess?: (c: GeoCoords) => void, onDenied?: () => void) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('unavailable');
      onDenied?.();
      return;
    }
    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setCoords(next);
        setStatus('granted');
        onSuccess?.(next);
      },
      () => {
        setStatus('denied');
        onDenied?.();
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }, []);

  return { status, coords, request };
}
