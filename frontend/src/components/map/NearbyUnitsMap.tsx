import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getEnv } from '../../config/env';
import type { UnitSummary } from '../../api/types';
import { mapUnitSummaryToPinView } from '../../api/mappers';
import { Icon } from '../ui/Icon';

interface NearbyUnitsMapProps {
  units: UnitSummary[];
  centerLat: number;
  centerLng: number;
}

const DEFAULT_FALLBACK_UNITS: UnitSummary[] = [
  {
    cnes_code: '9990001',
    name: 'UBS República',
    address: 'Praça da Bandeira, 15 — Centro',
    city: 'São Paulo',
    uf: 'SP',
    lat: -23.5489,
    lng: -46.6388,
    phone: '(11) 3333-0180',
    distance_m: 850,
    is_open: true,
    closes_at: '19:00',
    kind: 'ubs',
  },
  {
    cnes_code: '9990002',
    name: 'UBS Sé',
    address: 'Rua Frederico Alvarenga, 259 — Sé',
    city: 'São Paulo',
    uf: 'SP',
    lat: -23.5515,
    lng: -46.6302,
    phone: '(11) 3105-4210',
    distance_m: 1320,
    is_open: true,
    closes_at: '19:00',
    kind: 'ubs',
  },
  {
    cnes_code: '9990003',
    name: 'UBS Santa Cecília',
    address: 'Rua Vitorino Carmilo, 599 — Santa Cecília',
    city: 'São Paulo',
    uf: 'SP',
    lat: -23.5362,
    lng: -46.6512,
    phone: '(11) 3826-1900',
    distance_m: 1940,
    is_open: true,
    closes_at: '19:00',
    kind: 'hospital',
  },
];

const PIN_POSITIONS = ['pin-main', 'pin-second', 'pin-third'] as const;

function MapCenterUpdater({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: false });
  }, [lat, lng, map]);
  return null;
}

function buildUnitDivIcon(kind: 'ubs' | 'hospital' | 'other', isMain: boolean): L.DivIcon {
  const bg = kind === 'hospital' ? '#3b7796' : '#087f70';
  const size = isMain ? 38 : 32;
  return L.divIcon({
    className: 'leaflet-custom-pin',
    html: `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;background:${bg};color:#fff;border:3px solid #fff;border-radius:50% 50% 50% 8px;transform:rotate(-45deg);box-shadow:0 4px 10px rgba(10,77,69,0.25);"><svg width="${isMain ? 19 : 15}" height="${isMain ? 19 : 15}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(45deg)"><path d="M4 21h16M6 21V5h12v16M9 9h6M12 6v6M9 16h2M13 16h2"/></svg></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

const userLocationDivIcon = L.divIcon({
  className: 'leaflet-user-pin',
  html: `<span class="you-leaflet-badge"><i></i>Você está aqui</span>`,
  iconSize: [110, 26],
  iconAnchor: [55, 13],
});

export function NearbyUnitsMap({ units, centerLat, centerLng }: NearbyUnitsMapProps) {
  const [activePinCnes, setActivePinCnes] = useState<string | null>(null);
  const env = getEnv();

  const effectiveUnits = units.length > 0 ? units.slice(0, 6) : DEFAULT_FALLBACK_UNITS;
  const pinViews = useMemo(
    () => effectiveUnits.map((u) => mapUnitSummaryToPinView(u)),
    [effectiveUnits],
  );

  return (
    <div className="map" aria-label="Mapa interativo com unidades próximas">
      <div className="map-leaflet-wrapper">
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={14}
          scrollWheelZoom={false}
          className="map-leaflet-container"
          attributionControl={true}
        >
          <MapCenterUpdater lat={centerLat} lng={centerLng} />
          <TileLayer url={env.VITE_MAP_TILE_URL} attribution={env.VITE_MAP_ATTRIBUTION} />

          <Marker position={[centerLat, centerLng]} icon={userLocationDivIcon} />

          {pinViews.map((pin, idx) => (
            <Marker
              key={pin.cnes}
              position={[pin.lat, pin.lng]}
              icon={buildUnitDivIcon(pin.kind, idx === 0)}
              eventHandlers={{
                click: () => setActivePinCnes(pin.cnes),
              }}
            >
              <Popup>
                <div className="map-popup-card">
                  <strong>{pin.name}</strong>
                  <p>{pin.address}</p>
                  <small>
                    {pin.statusLabel}
                    {pin.distanceLabel ? ` • ${pin.distanceLabel}` : ''}
                  </small>
                  <Link to={pin.detailHref}>Ver detalhes da unidade →</Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Camada de pinos interativos por teclado/leitor de tela (preserva visual e acessibilidade do protótipo) */}
      {pinViews.slice(0, 3).map((u, idx) => {
        const pinClass = PIN_POSITIONS[idx] ?? 'pin-third';
        const isActive = activePinCnes === u.cnes;
        return (
          <span
            key={u.cnes}
            role="button"
            tabIndex={0}
            aria-label={u.name}
            className={`map-pin ${pinClass}`}
            onClick={() => setActivePinCnes(u.cnes)}
            onFocus={() => setActivePinCnes(u.cnes)}
            onBlur={() => setActivePinCnes(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActivePinCnes(isActive ? null : u.cnes);
              }
            }}
          >
            <Icon name="hospital" size={idx === 0 ? 21 : 17} />
            {isActive && <span className="pin-tooltip">{u.name}</span>}
          </span>
        );
      })}

      <span className="you">
        <i />
        Você está aqui
      </span>

      <div className="map-legend">
        <span>
          <i /> UBS
        </span>
        <span>
          <i /> Hospital
        </span>
      </div>
    </div>
  );
}
