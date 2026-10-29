import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCities, useLocationSelection, useStates } from '../../features/location/useLocation';
import { useGeolocation } from '../../hooks/useGeolocation';
import { Icon } from '../ui/Icon';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { location, selectLocation } = useLocationSelection();
  const [draftUf, setDraftUf] = useState(location.uf);
  const statesQuery = useStates();
  const citiesQuery = useCities(draftUf);
  const geo = useGeolocation();
  const pickerRef = useRef<HTMLDivElement>(null);
  const routeLocation = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setDraftUf(location.uf);
  }, [location.uf]);

  useEffect(() => {
    setMenuOpen(false);
    setPickerOpen(false);
  }, [routeLocation.pathname]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [pickerOpen]);

  const handleCitySelect = (ibgeCode: string) => {
    const city = citiesQuery.data?.find((c) => c.ibge_code === ibgeCode);
    if (!city) return;
    selectLocation({
      uf: city.uf,
      cityName: city.name,
      ibgeCode: city.ibge_code,
      lat: city.lat,
      lng: city.lng,
      label: `${city.name}, ${city.uf}`,
    });
    setPickerOpen(false);
  };

  const handleUseCurrentLocation = () => {
    geo.request(
      (coords) => {
        selectLocation({
          ...location,
          lat: coords.lat,
          lng: coords.lng,
          label: 'Localização atual',
        });
        setPickerOpen(false);
      },
      () => {
        // Permissão negada: mantém o popover aberto para seleção manual (caso de borda 1.1).
      },
    );
  };

  const scrollToFooter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setMenuOpen(false);
    const el = document.getElementById('sobre');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/#sobre');
    }
  };

  return (
    <header className="site-header">
      <Link
        className="brand"
        to="/"
        aria-label="BRchain Saúde — página inicial"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <span className="brand-symbol">
          <i />
          <i />
          <i />
          <i />
        </span>
        <strong>
          BR<span>chain</span>
        </strong>
        <em>SAÚDE</em>
      </Link>

      <nav className={menuOpen ? 'open' : ''} aria-label="Navegação principal">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Início
        </NavLink>
        <NavLink to="/medicamentos" className={({ isActive }) => (isActive ? 'active' : '')}>
          Medicamentos
        </NavLink>
        <NavLink to="/doencas" className={({ isActive }) => (isActive ? 'active' : '')}>
          Doenças e sintomas
        </NavLink>
        <NavLink to="/unidades" className={({ isActive }) => (isActive ? 'active' : '')}>
          Unidades de saúde
        </NavLink>
        <a href="#sobre" onClick={scrollToFooter}>
          Sobre o portal
        </a>
      </nav>

      <div className="header-actions" ref={pickerRef}>
        <button
          type="button"
          className="location-button"
          aria-expanded={pickerOpen}
          aria-haspopup="dialog"
          aria-label={`Selecionar localização. Atual: ${location.label}`}
          onClick={() => setPickerOpen((v) => !v)}
        >
          <Icon name="pin" size={17} />
          <span>{location.label}</span>
          <Icon name="chevron" size={14} />
        </button>

        {pickerOpen && (
          <div className="location-popover" role="dialog" aria-label="Selecionar cidade e estado">
            <label>
              ESTADO (UF)
              <select
                aria-label="Estado"
                value={draftUf}
                onChange={(e) => setDraftUf(e.target.value)}
              >
                {(statesQuery.data ?? [{ uf: 'SP', name: 'São Paulo' }]).map((s) => (
                  <option key={s.uf} value={s.uf}>
                    {s.name} ({s.uf})
                  </option>
                ))}
              </select>
            </label>

            <label>
              CIDADE
              <select
                aria-label="Cidade"
                value={draftUf === location.uf ? location.ibgeCode : ''}
                onChange={(e) => handleCitySelect(e.target.value)}
              >
                {draftUf !== location.uf && <option value="">Selecione a cidade…</option>}
                {(citiesQuery.data ?? []).map((c) => (
                  <option key={c.ibge_code} value={c.ibge_code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            {geo.status === 'denied' && (
              <p style={{ fontSize: 'var(--fs-8)', color: '#8b4a4e', margin: '4px 0 0' }}>
                Permissão de localização negada. Selecione sua cidade e estado acima.
              </p>
            )}

            <div className="location-popover-actions">
              <button type="button" onClick={handleUseCurrentLocation}>
                Usar GPS
              </button>
              <button type="button" className="primary" onClick={() => setPickerOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          className="menu-button"
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} />
        </button>
      </div>
    </header>
  );
}
