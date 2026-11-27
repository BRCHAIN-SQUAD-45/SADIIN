import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
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
  html: `<span class="you-leaflet-badge"><i></i>Você está aqui</span>`,
  iconSize: [110, 26],
  iconAnchor: [55, 13],
});

export function NearbyUnitsMap({
  units,
  centerLat,
  centerLng,
  showUserMarker = true,
}: NearbyUnitsMapProps) {
  const env = getEnv();

  // Sem UBS retornadas, o mapa fica sem pinos: nunca exibimos unidades fictícias.
  const effectiveUnits = useMemo(() => units.slice(0, 6), [units]);
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

          {showUserMarker && (
            <Marker position={[centerLat, centerLng]} icon={userLocationDivIcon} />
          )}

          {pinViews.map((pin, idx) => (
            <Marker
              key={pin.cnes}
              position={[pin.lat, pin.lng]}
              icon={buildUnitDivIcon(pin.kind, idx === 0)}
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

      {/* Os pinos e o "Você está aqui" são marcadores do próprio Leaflet (acima): acompanham o
          arrasto/zoom e são acessíveis por teclado. A antiga camada fixa do protótipo foi removida
          porque ficava parada sobre o mapa, duplicando os pinos. */}
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
