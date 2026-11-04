import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { toUnitSummary, unitsFixture } from '../../mocks/fixtures/meta';
import { NearbyUnitsMap } from './NearbyUnitsMap';

describe('Fase 5 — Mapa interativo Leaflet (US-04.1)', () => {
  it('renderiza container Leaflet, pinos das UBS, indicador "Você está aqui" e legenda UBS/Hospital', async () => {
    const user = userEvent.setup();
    const summaries = unitsFixture.map(toUnitSummary);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <NearbyUnitsMap units={summaries} centerLat={-23.5489} centerLng={-46.6388} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Mapa interativo com unidades próximas')).toBeInTheDocument();
    expect(screen.getAllByText('Você está aqui').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('UBS')).toBeInTheDocument();
    expect(screen.getByText('Hospital')).toBeInTheDocument();

    const pinButton = screen.getByRole('button', { name: 'UBS República' });
    await user.click(pinButton);
    expect(screen.getAllByText('UBS República').length).toBeGreaterThanOrEqual(1);
  });
});
