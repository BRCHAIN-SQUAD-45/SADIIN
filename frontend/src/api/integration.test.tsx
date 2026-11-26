import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApiError, codeFromStatus } from './client';
import {
  CityListSchema,
  PortalMetaSchema,
  UnitDetailSchema,
  UnitPageSchema,
  UnitStaffSchema,
} from './schemas';
import { mapAttendanceHistoryToChartView, mapUnitSummaryToPinView } from './mappers';
import { ErrorState } from '../components/ui/States';
import { formatDisplayName, formatOpenStatus, formatUnitUpdatedLabel } from '../utils/format';
import { isEmergencyCondition } from '../utils/triage';

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

  it('aceita /ubs/{cnes}/staff com rooms = null vindo do CNES real (Card 4)', () => {
    const realStaff = {
      professionals: 18,
      rooms: null,
      esf_teams: 2,
      reference_date: '202602',
      meta: {
        source: 'CNES / SIA / SIH - Ministério da Saúde',
        fetched_at: '2026-11-18T12:00:00+00:00',
        is_estimate: false,
        is_stale: false,
      },
    };
    expect(UnitStaffSchema.safeParse(realStaff).success).toBe(true);
  });

  it('normaliza nomes em CAIXA ALTA do CNES/ANVISA preservando siglas do SUS (Card 6)', () => {
    expect(formatDisplayName('AMA UBS JOSE BONIFACIO I')).toBe('AMA UBS Jose Bonifacio I');
    expect(formatDisplayName('SERVICO DE ATENCAO DOMICILIAR CAMPO LIMPO')).toBe(
      'Servico de Atencao Domiciliar Campo Limpo',
    );
    expect(formatDisplayName('ACEBROFILINA')).toBe('Acebrofilina');
    expect(formatDisplayName('UBS República')).toBe('UBS República');
  });

  it('formatDisplayName separa "/" e não trata "PAI" como sigla (revisão do PR #67)', () => {
    expect(formatDisplayName('AMA/UBS VILA NOVA')).toBe('AMA/UBS Vila Nova');
    expect(formatDisplayName('CASA DO PAI')).toBe('Casa do Pai');
  });

  it('emergências (AVC, infarto) são detectadas por CID-10 ou nome; gripe não é (revisão do PR #67)', () => {
    expect(isEmergencyCondition({ id: 'x', popular_name: 'AVC', cid10_code: 'I64' })).toBe(true);
    expect(isEmergencyCondition({ id: 'infarto', popular_name: 'Infarto agudo' })).toBe(true);
    expect(isEmergencyCondition({ id: 'gripe', popular_name: 'Gripe', cid10_code: 'J11' })).toBe(
      false,
    );
  });

  it('escala proporcionalmente barras de atendimento quando produção mensal ultrapassa 100 (Card 4)', () => {
    const chart = mapAttendanceHistoryToChartView({
      days: [
        { date: '2026-01-01', weekday_label: 'Janeiro/2026', attendances: 1750 },
        { date: '2026-02-01', weekday_label: 'Fevereiro/2026', attendances: 3500 },
      ],
      total: 5250,
      daily_average: 2625,
      meta: {
        source: 'CNES / SIA / SIH - Ministério da Saúde',
        fetched_at: '2026-11-18T12:00:00+00:00',
        is_estimate: false,
        is_stale: false,
      },
    });
    expect(chart.bars[0]?.heightPct).toBe(50);
    expect(chart.bars[1]?.heightPct).toBe(100);
  });
});
