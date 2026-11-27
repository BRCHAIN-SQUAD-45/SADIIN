import { describe, expect, it } from 'vitest';
import { directionsUrl, nearestBasicUnit } from './UnitRoutes';
import { toUnitSummary, unitsFixture } from '../../mocks/fixtures/meta';

const fixture = unitsFixture[0];
if (!fixture) throw new Error('Fixture de UBS ausente');
const base = toUnitSummary(fixture);
describe('Rotas e UBS mais próxima', () => {
  it('ignora hospitais e ordena UBS pela distância', () => {
    const near = { ...base, kind: 'ubs' as const, distance_m: 100 };
    expect(
      nearestBasicUnit([
        { ...near, kind: 'hospital', distance_m: 1 },
        { ...near, distance_m: 900 },
        near,
      ]),
    ).toBe(near);
    expect(nearestBasicUnit([])).toBeUndefined();
  });
  it('gera os três modos com origem e destino', () => {
    for (const mode of ['walking', 'driving', 'transit'] as const) {
      const url = new URL(directionsUrl(base, mode, { lat: -15, lng: -47 }));
      expect(url.searchParams.get('travelmode')).toBe(mode);
      expect(url.searchParams.get('origin')).toBe('-15,-47');
      expect(url.searchParams.get('destination')).toBe(`${base.lat},${base.lng}`);
    }
    expect(new URL(directionsUrl(base, 'walking')).searchParams.has('origin')).toBe(false);
  });
});
