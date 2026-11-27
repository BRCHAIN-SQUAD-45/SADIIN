import { useEffect, useMemo } from 'react';
import { nearestBasicUnit, UnitRoutes } from './UnitRoutes';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getEnv } from '../../config/env';
import type { UnitSummary } from '../../api/types';
import { mapUnitSummaryToPinView } from '../../api/mappers';

interface NearbyUnitsMapProps {
  units: UnitSummary[];
  centerLat: number;
  centerLng: number;
  /** `false` quando o centro é a primeira UBS (cidade sem coordenadas), não o usuário. */
  showUserMarker?: boolean;
  accuracy?: number;
  editing?: boolean;
  onPositionChange?: (lat: number, lng: number) => void;
}

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
  html: `<span style="display:block;width:20px;height:20px;border:3px solid white;background:#1677e8;border-radius:50%;box-shadow:0 0 0 3px #1677e866"></span>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export function NearbyUnitsMap({
  units,
  centerLat,
  centerLng,
  showUserMarker = true,
  accuracy,
  editing = false,
  onPositionChange,
}: NearbyUnitsMapProps) {
  const env = getEnv();

  // Sem UBS retornadas, o mapa fica sem pinos: nunca exibimos unidades fictícias.
  const effectiveUnits = useMemo(
    () =>
      units.filter(
        (u) =>
          Number.isFinite(u.lat) &&
          Number.isFinite(u.lng) &&
          u.lat >= -34 &&
          u.lat <= 6 &&
          u.lng >= -74 &&
          u.lng <= -28,
      ),
    [units],
  );
  const nearest = nearestBasicUnit(effectiveUnits);
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
          scrollWheelZoom={true}
          className="map-leaflet-container"
          attributionControl={true}
        >
          <MapCenterUpdater lat={centerLat} lng={centerLng} />
          <TileLayer url={env.VITE_MAP_TILE_URL} attribution={env.VITE_MAP_ATTRIBUTION} />

          {showUserMarker && (
            <>
              {accuracy !== undefined && Number.isFinite(accuracy) && accuracy > 0 && (
                <Circle
                  center={[centerLat, centerLng]}
                  radius={accuracy}
                  pathOptions={{ color: '#1677e8', fillOpacity: 0.12, weight: 1 }}
                />
              )}
              <Marker
                position={[centerLat, centerLng]}
                icon={userLocationDivIcon}
                zIndexOffset={2000}
                draggable={editing && Boolean(onPositionChange)}
                eventHandlers={{
                  dragend: (event) => {
                    const point = (event.target as L.Marker).getLatLng();
                    onPositionChange?.(point.lat, point.lng);
                  },
                }}
              >
                <Popup>
                  {editing ? 'Arraste e confirme sua posição' : 'Sua posição'}
                  {accuracy !== undefined ? ` (precisão: ${Math.round(accuracy)} m)` : ''}
                </Popup>
              </Marker>
            </>
          )}

          {pinViews.map((pin, idx) => {
            const unit = effectiveUnits[idx];
            if (!unit) return null;
            return (
              <Marker
                key={pin.cnes}
                title={pin.name}
                alt={pin.name}
                position={[pin.lat, pin.lng]}
                icon={buildUnitDivIcon(pin.kind, showUserMarker && pin.cnes === nearest?.cnes_code)}
              >
                <Popup>
                  <div className="map-popup-card">
                    <strong>{pin.name}</strong>
                    {showUserMarker && pin.cnes === nearest?.cnes_code && <p>UBS mais próxima</p>}
                    <p>{pin.address}</p>
                    <small>
                      {pin.statusLabel}
                      {pin.distanceLabel ? ` • ${pin.distanceLabel}` : ''}
                    </small>
                    <UnitRoutes
                      unit={unit}
                      origin={showUserMarker ? { lat: centerLat, lng: centerLng } : undefined}
                    />
                    <Link to={pin.detailHref}>Ver detalhes da unidade →</Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <div className="map-legend">
        {showUserMarker && (
          <span>
            <i style={{ background: '#1677e8' }} /> Sua posição estimada
          </span>
        )}
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
