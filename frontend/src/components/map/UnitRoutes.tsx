import type { UnitSummary } from '../../api/types';

export function nearestBasicUnit(units: UnitSummary[]) {
  return units.filter((u) => u.kind === 'ubs').sort((a, b) =>
    (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity) || a.name.localeCompare(b.name),
  )[0];
}

export function directionsUrl(unit: UnitSummary, mode: 'walking' | 'driving' | 'transit', origin?: { lat: number; lng: number }) {
  const params = new URLSearchParams({ api: '1', destination: `${unit.lat},${unit.lng}`, travelmode: mode });
  if (origin) params.set('origin', `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params}`;
}

export function UnitRoutes({ unit, origin }: { unit: UnitSummary; origin?: { lat: number; lng: number } }) {
  return <div className="ubs-routes">
    <strong>Como chegar</strong>
    <div className="ubs-route-options">
      {([['walking', 'A pé'], ['driving', 'Carro'], ['transit', 'Ônibus / transporte público']] as const).map(([mode, label]) =>
        <a key={mode} href={directionsUrl(unit, mode, origin)} target="_blank" rel="noopener noreferrer">{label} ↗</a>
      )}
    </div>
    <small>Abre o Google Maps com trajetos, duração e distância conforme disponibilidade. {origin ? 'Origem: sua localização.' : 'Informe a origem no Google Maps.'}</small>
  </div>;
}
