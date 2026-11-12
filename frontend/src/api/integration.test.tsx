import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApiError, codeFromStatus } from './client';
import { CityListSchema, PortalMetaSchema, UnitDetailSchema, UnitPageSchema } from './schemas';
import { mapUnitSummaryToPinView } from './mappers';
import { ErrorState } from '../components/ui/States';
import { formatOpenStatus, formatUnitUpdatedLabel } from '../utils/format';

/**
 * Integração front ↔ back (FastAPI): as amostras abaixo foram copiadas de respostas
 * reais do back-end (CNES/IBGE) e precisam passar nos schemas do contrato.
 */
describe('Integração com o back-end real', () => {
  it('aceita /meta com establishments_count = null (CNES não publica o total)', () => {
    const real = {
      data_updated_at: '2026-10-16T00:00:00+00:00',
      establishments_count: null,
      sources_count: 2,
    };
    expect(PortalMetaSchema.safeParse(real).success).toBe(true);
  });

  it('aceita cidades do IBGE sem coordenadas', () => {
    const real = [{ ibge_code: '3500105', name: 'Adamantina', uf: 'SP' }];
    expect(CityListSchema.safeParse(real).success).toBe(true);
  });

  it('aceita a lista de UBS com is_open = null e total = null', () => {
    const real = {
      items: [
        {
          cnes_code: '2787946',
          name: 'UBS JARDIM VISTA ALEGRE',
          address: 'RUA IBIRAIARAS 21, BRASILANDIA',
          city: 'São Paulo',
          uf: 'SP',
          lat: -23.45,
          lng: -46.68,
          phone: null,
          is_open: null,
          kind: 'ubs',
        },
      ],
      page: 1,
      page_size: 20,
      total: null,
      meta: {
        source: 'CNES - Ministério da Saúde',
        fetched_at: '2026-11-11T01:47:34.190427+00:00',
        is_estimate: false,
        is_stale: false,
      },
    };
    const parsed = UnitPageSchema.safeParse(real);
    expect(parsed.success).toBe(true);
    // phone null vira undefined, para o restante do front tratar "sem telefone" de um jeito só.
    expect(parsed.success && parsed.data.items[0]!.phone).toBeUndefined();
  });

  it('aceita a ficha da UBS sem opening_hours/today_label e com turno do CNES', () => {
    const real = {
      cnes_code: '2787946',
      name: 'UBS JARDIM VISTA ALEGRE',
      address: 'RUA IBIRAIARAS 21, BRASILANDIA',
      city: 'São Paulo',
      uf: 'SP',
      lat: -23.45,
      lng: -46.68,
      is_open: null,
      kind: 'ubs',
      phone: '(11)52374556',
      data_updated_at: '2026-02-27T00:00:00+00:00',
      source_label: 'CNES - Ministério da Saúde',
      turno_atendimento: 'ATENDIMENTO NOS TURNOS DA MANHA, TARDE E NOITE',
    };
    expect(UnitDetailSchema.safeParse(real).success).toBe(true);
  });

  it('rejeita data_updated_at só com a data (o back-end precisa mandar ISO datetime)', () => {
    const parsed = UnitDetailSchema.safeParse({
      cnes_code: '1',
      name: 'X',
      address: 'Y',
      city: 'Z',
      uf: 'SP',
      lat: 0,
      lng: 0,
      is_open: null,
      kind: 'ubs',
      data_updated_at: '2026-02-27',
      source_label: 'CNES',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('HTTP 501 — fonte ainda não integrada', () => {
  it('mapeia 501 para SOURCE_UNAVAILABLE', () => {
    expect(codeFromStatus(501)).toBe('SOURCE_UNAVAILABLE');
    expect(codeFromStatus(500)).toBe('INTERNAL');
  });

  it('ErrorState mostra "Dados ainda não disponíveis" sem botão de tentar novamente', () => {
    const error = new ApiError({
      code: 'SOURCE_UNAVAILABLE',
      status: 501,
      endpoint: 'GET /news',
      message: 'Não há feed de notícias integrado.',
    });
    render(<ErrorState error={error} onRetry={() => undefined} />);
    expect(screen.getByText('Dados ainda não disponíveis')).toBeInTheDocument();
    expect(screen.getByText('Não há feed de notícias integrado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tentar novamente/ })).not.toBeInTheDocument();
  });

  it('erros reais (ex.: 502) continuam com botão de tentar novamente', () => {
    const error = new ApiError({
      code: 'INTERNAL',
      status: 502,
      endpoint: 'GET /ubs',
      message: 'x',
    });
    render(<ErrorState error={error} onRetry={() => undefined} />);
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument();
  });
});

describe('Status de funcionamento e datas', () => {
  it('null nunca vira "Fechada"', () => {
    expect(formatOpenStatus(true).label).toBe('Aberta agora');
    expect(formatOpenStatus(false).label).toBe('Fechada');
    expect(formatOpenStatus(null)).toEqual({
      label: 'Horário não informado',
      badgeClass: 'open-badge unknown',
    });
  });

  it('o pin do mapa usa o mesmo rótulo neutro', () => {
    const pin = mapUnitSummaryToPinView({
      cnes_code: '1',
      name: 'UBS',
      address: 'Rua',
      city: 'São Paulo',
      uf: 'SP',
      lat: 0,
      lng: 0,
      is_open: null,
      kind: 'ubs',
    });
    expect(pin.statusLabel).toBe('Horário não informado');
  });

  it('data de atualização só diz "Hoje" quando é hoje', () => {
    const now = new Date('2026-11-11T12:00:00Z');
    expect(formatUnitUpdatedLabel('2026-11-11T08:42:00Z', now)).toBe('Hoje, às 08:42');
    expect(formatUnitUpdatedLabel('2026-02-27T00:00:00+00:00', now)).toBe('27/02/2026');
  });
});
