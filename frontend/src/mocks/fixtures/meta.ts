import type {
  AttendanceHistory,
  Category,
  CityItem,
  ConditionDetail,
  MedicationDetail,
  NewsPayload,
  PortalMeta,
  ProvenanceMeta,
  RegionalDashboard,
  SearchFallback,
  SourceItem,
  StateItem,
  UnitDetail,
  UnitMetrics,
  UnitService,
  UnitStaff,
  UnitSummary,
} from '../../api/types';

/**
 * Fixtures de DEMONSTRAÇÃO do protótipo.
 * Todo `meta.source` é explicitamente `"MOCK"` para nunca confundir com dado oficial.
 * Códigos CNES são fictícios (`9990001`…).
 */

export const MOCK_FETCHED_AT = '2025-05-28T11:42:00Z';

export function buildMockMeta(opts?: { isEstimate?: boolean; isStale?: boolean }): ProvenanceMeta {
  return {
    source: 'MOCK',
    fetched_at: MOCK_FETCHED_AT,
    is_estimate: opts?.isEstimate ?? false,
    is_stale: opts?.isStale ?? false,
  };
}

export const metaFixture: PortalMeta = {
  data_updated_at: MOCK_FETCHED_AT,
  establishments_count: 452818,
  sources_count: 6,
};

export const statesFixture: StateItem[] = [
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'BA', name: 'Bahia' },
];

export const citiesByStateFixture: Record<string, CityItem[]> = {
  SP: [
    { ibge_code: '3550308', name: 'São Paulo', uf: 'SP', lat: -23.5489, lng: -46.6388 },
    { ibge_code: '3509502', name: 'Campinas', uf: 'SP', lat: -22.9056, lng: -47.0608 },
    { ibge_code: '3548500', name: 'Santos', uf: 'SP', lat: -23.9608, lng: -46.3336 },
  ],
  RJ: [
    { ibge_code: '3304557', name: 'Rio de Janeiro', uf: 'RJ', lat: -22.9068, lng: -43.1729 },
    { ibge_code: '3303302', name: 'Niterói', uf: 'RJ', lat: -22.8832, lng: -43.1034 },
  ],
  DF: [{ ibge_code: '5300108', name: 'Brasília', uf: 'DF', lat: -15.7939, lng: -47.8828 }],
  MG: [{ ibge_code: '3106200', name: 'Belo Horizonte', uf: 'MG', lat: -19.9167, lng: -43.9345 }],
  BA: [{ ibge_code: '2927408', name: 'Salvador', uf: 'BA', lat: -12.9714, lng: -38.5014 }],
};

export const medicationCategoriesFixture: Category[] = [
  { id: 'analgesicos', name: 'Analgésicos', slug: 'analgesicos' },
  { id: 'antialergicos', name: 'Antialérgicos', slug: 'antialergicos' },
  { id: 'antibioticos', name: 'Antibióticos', slug: 'antibioticos' },
  { id: 'uso-continuo', name: 'Uso contínuo', slug: 'uso-continuo' },
];

export const medicationsFixture: MedicationDetail[] = [
  {
    id: 'dipirona',
    name: 'Dipirona',
    subtitle: 'Analgésico e antitérmico',
    tag: 'Mais consultado',
    category_id: 'analgesicos',
    requires_prescription: false,
    adult_use: true,
    image_url:
      'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    image_alt: 'Comprimidos brancos, azuis e alaranjados',
    leaflet_url: 'https://consultas.anvisa.gov.br/#/bulario/',
    indications: ['Dor leve a moderada', 'Estados febris'],
    contraindications: ['Hipersensibilidade a pirazolonas', 'Porfiria hepática aguda'],
    side_effects: ['Reações cutâneas alérgicas', 'Queda transitória da pressão arterial'],
  },
  {
    id: 'paracetamol',
    name: 'Paracetamol',
    subtitle: 'Analgésico e antitérmico',
    tag: 'Uso adulto e pediátrico',
    category_id: 'analgesicos',
    requires_prescription: false,
    adult_use: true,
    image_url:
      'https://images.unsplash.com/photo-1628771065518-0d82f1938462?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    image_alt: 'Frasco com comprimidos coloridos',
    leaflet_url: 'https://consultas.anvisa.gov.br/#/bulario/',
    indications: ['Redução da febre', 'Alívio temporário de dores leves a moderadas'],
    contraindications: ['Doença hepática grave'],
    side_effects: ['Náusea', 'Reações de hipersensibilidade raras'],
  },
  {
    id: 'ibuprofeno',
    name: 'Ibuprofeno',
    subtitle: 'Analgésico e anti-inflamatório',
    tag: 'Venda sob orientação',
    category_id: 'analgesicos',
    requires_prescription: false,
    adult_use: true,
    image_url:
      'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    image_alt: 'Comprimido branco e alaranjado',
    leaflet_url: 'https://consultas.anvisa.gov.br/#/bulario/',
    indications: ['Processos inflamatórios e dolorosos', 'Febre'],
    contraindications: ['Úlcera péptica ativa', 'Insuficiência renal ou cardíaca grave'],
    side_effects: ['Desconforto gástrico', 'Azia'],
  },
  {
    id: 'amoxicilina',
    name: 'Amoxicilina',
    subtitle: 'Antibiótico',
    tag: 'Requer receita',
    category_id: 'antibioticos',
    requires_prescription: true,
    adult_use: true,
    image_url:
      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    image_alt: 'Cartela de comprimidos',
    leaflet_url: 'https://consultas.anvisa.gov.br/#/bulario/',
    indications: ['Infecções bacterianas das vias aéreas, urinárias e pele'],
    contraindications: ['Alergia a penicilinas ou cefalosporinas'],
    side_effects: ['Diarreia', 'Náusea', 'Erupção cutânea'],
  },
  {
    id: 'loratadina',
    name: 'Loratadina',
    subtitle: 'Antialérgico',
    tag: 'Alergias e rinite',
    category_id: 'antialergicos',
    requires_prescription: false,
    adult_use: true,
    image_url:
      'https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    image_alt: 'Comprimidos de cores variadas',
    leaflet_url: 'https://consultas.anvisa.gov.br/#/bulario/',
    indications: ['Alívio dos sintomas de rinite alérgica', 'Urticária'],
    contraindications: ['Hipersensibilidade a componentes da fórmula'],
    side_effects: ['Sonolência leve', 'Boca seca'],
  },
  {
    id: 'omeprazol',
    name: 'Omeprazol',
    subtitle: 'Redutor de acidez gástrica',
    tag: 'Saúde digestiva',
    category_id: 'uso-continuo',
    requires_prescription: false,
    adult_use: true,
    image_url:
      'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    image_alt: 'Medicamentos e cápsulas sobre mesa',
    leaflet_url: 'https://consultas.anvisa.gov.br/#/bulario/',
    indications: ['Refluxo gastroesofágico', 'Úlceras gástricas e duodenais'],
    contraindications: ['Uso concomitante com nelfinavir'],
    side_effects: ['Dor de cabeça', 'Dor abdominal'],
  },
];

export const conditionCategoriesFixture: Category[] = [
  { id: 'alergias', name: 'Alergias', slug: 'alergias' },
  { id: 'sintomas', name: 'Sintomas', slug: 'sintomas' },
  { id: 'doencas-respiratorias', name: 'Doenças respiratórias', slug: 'doencas-respiratorias' },
  { id: 'condicoes-cronicas', name: 'Condições crônicas', slug: 'condicoes-cronicas' },
];

export const conditionsFixture: ConditionDetail[] = [
  {
    id: 'rinite-alergica',
    popular_name: 'Rinite alérgica',
    cid10_code: 'J30.4',
    subtitle: 'Espirros, coriza e congestão nasal',
    tag: 'Alergia respiratória',
    category_id: 'alergias',
    main_symptoms: ['Espirros em salva', 'Coriza clara', 'Congestão e coceira nasal'],
    image_url:
      'https://images.unsplash.com/reserve/yra1GBrGTB65qtZpFaly_day%202.jpg?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    image_alt: 'Pólen sendo liberado por uma planta',
    prevention: [
      'Manter ambientes ventilados e livres de poeira',
      'Lavar roupas de cama semanalmente',
    ],
    treatment: ['Higiene nasal com soro fisiológico', 'Avaliação médica na UBS para controle'],
  },
  {
    id: 'alergia-ao-polen',
    popular_name: 'Alergia ao pólen',
    cid10_code: 'J30.1',
    subtitle: 'Coceira, lacrimejamento e espirros',
    tag: 'Alergia sazonal',
    category_id: 'alergias',
    main_symptoms: ['Coceira ocular e nasal', 'Lacrimejamento', 'Espirros frequentes'],
    image_url:
      'https://images.unsplash.com/photo-1677257359684-c2ad08528290?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    image_alt: 'Pessoa segurando um ramo de flores',
    prevention: [
      'Reduzir exposição em dias secos e com vento',
      'Higienizar olhos e face ao chegar em casa',
    ],
    treatment: ['Lavagem nasal com solução salina', 'Orientação profissional para manejo sazonal'],
  },
  {
    id: 'dengue',
    popular_name: 'Dengue',
    cid10_code: 'A90',
    subtitle: 'Febre alta, dor no corpo e manchas',
    tag: 'Atenção epidemiológica',
    category_id: 'sintomas',
    main_symptoms: [
      'Febre alta de início súbito',
      'Dor muscular e atrás dos olhos',
      'Manchas vermelhas na pele',
    ],
    image_url:
      'https://images.unsplash.com/photo-1568277350319-5b17fd39d623?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    image_alt: 'Pessoa em campo de flores amarelas',
    prevention: [
      'Eliminar água parada em pratos de plantas, calhas e garrafas',
      'Usar repelente e telas',
    ],
    treatment: [
      'Hidratação abundante imediata',
      'Procurar UBS ao primeiro sinal de febre; evitar anti-inflamatórios por conta própria',
    ],
  },
  {
    id: 'sinusite',
    popular_name: 'Sinusite',
    cid10_code: 'J01',
    subtitle: 'Dor facial, secreção e congestão',
    tag: 'Doença respiratória',
    category_id: 'doencas-respiratorias',
    main_symptoms: ['Pressão ou dor facial', 'Secreção nasal espessa', 'Obstrução nasal'],
    image_url:
      'https://images.unsplash.com/photo-1568277350296-004d2c54bcf0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    image_alt: 'Pessoa protegendo o rosto',
    prevention: ['Hidratação adequada', 'Tratar quadros gripais e alérgicos precocemente'],
    treatment: [
      'Lavagem nasal com soro fisiológico',
      'Avaliação clínica se sintomas persistirem por mais de 10 dias',
    ],
  },
  {
    id: 'hipertensao',
    popular_name: 'Hipertensão',
    cid10_code: 'I10',
    subtitle: 'Frequentemente não apresenta sintomas',
    tag: 'Condição crônica',
    category_id: 'condicoes-cronicas',
    main_symptoms: ['Geralmente silenciosa', 'Dor de cabeça ou tontura em picos pressóricos'],
    image_url:
      'https://images.unsplash.com/photo-1618170572625-364bf7f28a8b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    image_alt: 'Pessoa segurando uma flor amarela',
    prevention: [
      'Reduzir consumo de sódio e ultraprocessados',
      'Praticar atividade física regular',
    ],
    treatment: [
      'Acompanhamento contínuo na Atenção Primária (UBS)',
      'Retirada gratuita de medicamentos pelo SUS',
    ],
  },
  {
    id: 'gripe',
    popular_name: 'Gripe',
    cid10_code: 'J11',
    subtitle: 'Febre, tosse, dor no corpo e cansaço',
    tag: 'Infecção respiratória',
    category_id: 'doencas-respiratorias',
    main_symptoms: ['Febre', 'Tosse seca', 'Dor no corpo e fadiga'],
    image_url:
      'https://images.unsplash.com/photo-1632184671096-a92d71b80d90?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    image_alt: 'Pessoa usando máscara de proteção',
    prevention: ['Vacinação anual gratuita no SUS', 'Higienização frequente das mãos'],
    treatment: [
      'Repouso e hidratação',
      'Procurar atendimento se houver falta de ar ou febre persistente',
    ],
  },
];

export const unitsFixture: UnitDetail[] = [
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
    opening_hours: { open: '07:00', close: '19:00' },
    today_label: 'Quarta-feira, 28 de maio',
    data_updated_at: '2025-05-28T08:42:00Z',
    source_label: 'CNES / e-SUS APS',
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
    opening_hours: { open: '07:00', close: '19:00' },
    today_label: 'Quarta-feira, 28 de maio',
    data_updated_at: '2025-05-28T08:42:00Z',
    source_label: 'CNES / e-SUS APS',
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
    opening_hours: { open: '07:00', close: '19:00' },
    today_label: 'Quarta-feira, 28 de maio',
    data_updated_at: '2025-05-28T08:42:00Z',
    source_label: 'CNES / e-SUS APS',
  },
];

export const toUnitSummary = (u: UnitDetail): UnitSummary => ({
  cnes_code: u.cnes_code,
  name: u.name,
  address: u.address,
  city: u.city,
  uf: u.uf,
  lat: u.lat,
  lng: u.lng,
  phone: u.phone,
  distance_m: u.distance_m,
  is_open: u.is_open,
  closes_at: u.closes_at,
  kind: u.kind,
});

export function buildUnitMetricsFixture(
  cnes: string,
  opts?: { isEstimate?: boolean; isStale?: boolean },
): UnitMetrics {
  const base: Record<string, Omit<UnitMetrics, 'meta'>> = {
    '9990001': {
      attendances_month: 3842,
      attendances_delta_pct: 6.2,
      avg_wait_minutes: 24,
      movement_level: 'moderado',
      capacity_pct: 72,
      best_time_hint: 'Entre 14h e 16h, com menor tempo de espera.',
      registered_coverage: 18420,
    },
    '9990002': {
      attendances_month: 3190,
      attendances_delta_pct: 4.1,
      avg_wait_minutes: 18,
      movement_level: 'baixo',
      capacity_pct: 58,
      best_time_hint: 'Entre 10h e 12h, com menor tempo de espera.',
      registered_coverage: 15200,
    },
    '9990003': {
      attendances_month: 4120,
      attendances_delta_pct: 8.5,
      avg_wait_minutes: 35,
      movement_level: 'alto',
      capacity_pct: 86,
      best_time_hint: 'Entre 15h e 17h, com menor tempo de espera.',
      registered_coverage: 21300,
    },
  };
  return {
    ...(base[cnes] ?? base['9990001']!),
    meta: buildMockMeta(opts),
  };
}

export function buildAttendanceHistoryFixture(opts?: {
  isEstimate?: boolean;
  isStale?: boolean;
}): AttendanceHistory {
  // Barras exatas do protótipo: Seg 68, Ter 84, Qua 75, Qui 92, Sex 79, Sáb 47, Dom 18 (soma real = 463).
  const days = [
    { date: '2025-05-22', weekday_label: 'Seg', attendances: 68 },
    { date: '2025-05-23', weekday_label: 'Ter', attendances: 84 },
    { date: '2025-05-24', weekday_label: 'Qua', attendances: 75 },
    { date: '2025-05-25', weekday_label: 'Qui', attendances: 92 },
    { date: '2025-05-26', weekday_label: 'Sex', attendances: 79 },
    { date: '2025-05-27', weekday_label: 'Sáb', attendances: 47 },
    { date: '2025-05-28', weekday_label: 'Dom', attendances: 18 },
  ];
  const total = days.reduce((acc, d) => acc + d.attendances, 0);
  return {
    days,
    total,
    daily_average: Math.round(total / days.length),
    meta: buildMockMeta(opts),
  };
}

export const unitServicesFixture: UnitService[] = [
  {
    id: 'clinica-geral',
    name: 'Clínica geral',
    detail: 'Consultas e acompanhamento',
    category: 'Consultas',
    icon_key: 'hospital',
  },
  {
    id: 'vacinacao',
    name: 'Vacinação',
    detail: 'Calendário nacional do SUS',
    category: 'Prevenção',
    icon_key: 'shield',
  },
  {
    id: 'saude-da-mulher',
    name: 'Saúde da mulher',
    detail: 'Pré-natal e exames preventivos',
    category: 'Consultas',
    icon_key: 'heart',
  },
  {
    id: 'farmacia',
    name: 'Farmácia',
    detail: 'Retirada de medicamentos',
    category: 'Apoio',
    icon_key: 'pill',
  },
  {
    id: 'enfermagem',
    name: 'Enfermagem',
    detail: 'Curativos e procedimentos',
    category: 'Procedimentos',
    icon_key: 'activity',
  },
  {
    id: 'saude-da-familia',
    name: 'Saúde da família',
    detail: 'Acompanhamento domiciliar',
    category: 'Consultas',
    icon_key: 'people',
  },
];

export function buildUnitStaffFixture(opts?: {
  isEstimate?: boolean;
  isStale?: boolean;
}): UnitStaff {
  return {
    professionals: 32,
    rooms: 8,
    esf_teams: 4,
    reference_date: '2025-05',
    meta: buildMockMeta(opts),
  };
}

export function buildRegionalDashboardFixture(opts?: {
  isEstimate?: boolean;
  isStale?: boolean;
}): RegionalDashboard {
  return {
    headline: {
      kicker: 'ATENÇÃO EPIDEMIOLÓGICA',
      title: 'Casos de dengue apresentam queda na sua região',
      delta_pct: -18.4,
      comparison_label: 'em comparação com as últimas quatro semanas',
      series: [72, 84, 68, 61, 66, 52, 44, 38, 31, 25],
      source_label: 'SINAN / OpenDataSUS',
      updated_label: 'Atualizado há 2 dias',
    },
    stats: [
      {
        key: 'primary_care_coverage',
        label: 'COBERTURA DA ATENÇÃO PRIMÁRIA',
        value: '78,6%',
        trend_pct: 2.3,
        caption: 'nos últimos 12 meses',
        tone: 'blue',
      },
      {
        key: 'sus_establishments',
        label: 'ESTABELECIMENTOS NO SUS',
        value: '452.818',
        caption: 'Em todos os 5.570 municípios',
        tone: 'green',
      },
      {
        key: 'avg_update_window',
        label: 'TEMPO MÉDIO DE ATUALIZAÇÃO',
        value: '24 horas',
        caption: 'Dados verificados automaticamente',
        tone: 'amber',
      },
    ],
    meta: buildMockMeta(opts),
  };
}

export const newsFixture: NewsPayload = {
  featured: {
    id: 'campanha-gripe-2025',
    category: 'VACINAÇÃO',
    title: 'Campanha contra a gripe é ampliada para toda a população',
    summary: 'Unidades da capital oferecem vacinação sem agendamento a partir desta semana.',
    image_url:
      'https://images.unsplash.com/photo-1632184671096-a92d71b80d90?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1000',
    published_at: '2025-05-28T09:00:00Z',
    source_label: 'Há 3 horas • Secretaria Municipal de Saúde',
  },
  items: [
    {
      id: 'ubs-sabados-centro',
      category: 'ATENÇÃO PRIMÁRIA',
      title: 'Três novas UBS passam a atender aos sábados na região central',
      summary: 'Confira endereços e horários especiais.',
      published_at: '2025-05-28T08:00:00Z',
      source_label: 'Secretaria Municipal de Saúde',
    },
    {
      id: 'boletim-dengue-queda',
      category: 'ALERTA DE SAÚDE',
      title: 'Casos de dengue recuam, mas prevenção deve continuar',
      summary: 'Boletim regional aponta queda de 18%.',
      published_at: '2025-05-27T10:00:00Z',
      source_label: 'Vigilância em Saúde',
    },
    {
      id: 'mutirao-pressao-glicemia',
      category: 'SERVIÇOS',
      title: 'Mutirão oferece avaliação de pressão e glicemia',
      summary: 'Atendimento gratuito no próximo domingo.',
      published_at: '2025-05-25T10:00:00Z',
      source_label: 'Secretaria Municipal de Saúde',
    },
  ],
};

export const sourcesFixture: SourceItem[] = [
  { id: 'datasus', name: 'DATASUS', subtitle: 'Ministério da Saúde' },
  { id: 'cnes', name: 'CNES', subtitle: 'Estabelecimentos' },
  { id: 'esus-aps', name: 'e-SUS APS', subtitle: 'Atenção Primária' },
  { id: 'opendatasus', name: 'OpenDataSUS', subtitle: 'Dados abertos' },
  { id: 'rnds', name: 'RNDS', subtitle: 'Padrão FHIR R4' },
];

/** Mapeamento coloquial → termo oficial (US-01.1) e regras de fallback seguro nos mocks. */
const COLLOQUIAL_SYNONYMS: Record<string, string> = {
  'dor na barriga': 'Dor abdominal',
  'dor de cabeca': 'Cefaleia',
  'dor de cabeça': 'Cefaleia',
  'falta de ar': 'Dispneia',
  'pressao alta': 'Hipertensão',
  'pressão alta': 'Hipertensão',
};

const SELF_DIAGNOSIS_PATTERNS = [
  /estou com .+, o que (eu )?(tomo|fa[cç]o)/i,
  /qual rem[eé]dio tomar para/i,
  /tenho .+ e .+ e .+/i,
  /ser[aá] que (eu )?tenho/i,
];

const SYMPTOM_WORDS = ['dor', 'febre', 'tosse', 'coceira', 'mancha', 'enjoo', 'tontura', 'coriza'];

export function evaluateMockSearchFallback(
  rawQuery: string,
  type: string,
  forceFallback: boolean,
): { matchedTerm?: string; fallback: SearchFallback | null; confidence: number } {
  const q = rawQuery.trim().toLowerCase();
  const matchedTerm = COLLOQUIAL_SYNONYMS[q];

  if (forceFallback || SELF_DIAGNOSIS_PATTERNS.some((re) => re.test(q))) {
    return {
      matchedTerm,
      confidence: 0.42,
      fallback: {
        code: 'SELF_DIAGNOSIS',
        message: 'Sintomas complexos. Procure uma unidade de saúde.',
      },
    };
  }

  if (type === 'medications' && SYMPTOM_WORDS.some((w) => q.includes(w))) {
    return {
      matchedTerm,
      confidence: 0.65,
      fallback: {
        code: 'SYMPTOM_ON_MEDICATION_SEARCH',
        message: 'Consulte um profissional de saúde',
      },
    };
  }

  return { matchedTerm, confidence: 0.92, fallback: null };
}
