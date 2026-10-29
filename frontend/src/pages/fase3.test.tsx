import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '../queryClient';
import { routes } from '../router';

function renderAt(initialEntry: string) {
  const queryClient = createQueryClient();
  const memoryRouter = createMemoryRouter(routes, {
    initialEntries: [initialEntry],
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={memoryRouter} future={{ v7_startTransition: true }} />
    </QueryClientProvider>,
  );
}

describe('Fase 3 — Medicamentos, Doenças e Sintomas e Detalhes da UBS', () => {
  afterEach(() => {
    window.sessionStorage.removeItem('brchain.mockScenario');
  });

  it('renderiza página de Medicamentos, filtra por categoria via API e abre detalhe da bula (US-02.1, US-02.2, US-02.3)', async () => {
    const user = userEvent.setup();
    renderAt('/medicamentos');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Medicamentos' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Dipirona' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Amoxicilina' })).toBeInTheDocument();
    expect(screen.getByText('6 conteúdos disponíveis')).toBeInTheDocument();

    // Filtra pela categoria Antibióticos (US-02.2)
    await user.click(screen.getByRole('tab', { name: 'Antibióticos' }));
    await waitFor(() => {
      expect(screen.getByText('1 conteúdos disponíveis')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { level: 2, name: 'Amoxicilina' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Dipirona' })).not.toBeInTheDocument();

    // Abre detalhe do medicamento (US-02.3)
    await user.click(screen.getByRole('link', { name: /Ver informações completas/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Amoxicilina' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Requer receita médica')).toBeInTheDocument();
    expect(
      screen.getByText('Infecções bacterianas das vias aéreas, urinárias e pele'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Consultar bula oficial \(ANVISA\)/i }),
    ).toHaveAttribute('href', 'https://consultas.anvisa.gov.br/#/bulario/');
  });

  it('bloqueia recomendação de medicamento quando usuário relata sintoma e sugere categorias (US-02.1)', async () => {
    const user = userEvent.setup();
    renderAt('/medicamentos');

    const input = await screen.findByLabelText('Buscar medicamento pelo nome');
    await user.type(input, 'dor de cabeca');
    await user.click(screen.getByRole('button', { name: 'Pesquisar' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Consulte um profissional de saúde')).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'Analgésicos' })).toBeInTheDocument();
  });

  it('renderiza página de Doenças e Sintomas, aciona fallback seguro de IA e abre detalhe com CID-10 (US-03.1, US-03.2, US-03.3)', async () => {
    const user = userEvent.setup();
    renderAt('/doencas');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Doenças e sintomas' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Dengue' })).toBeInTheDocument();

    // Filtra por Doenças respiratórias (US-03.2)
    await user.click(screen.getByRole('tab', { name: 'Doenças respiratórias' }));
    await waitFor(() => {
      expect(screen.getByText('2 conteúdos disponíveis')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { level: 2, name: 'Sinusite' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Gripe' })).toBeInTheDocument();

    // Abre detalhe da Gripe (US-03.3)
    const gripeCard = screen.getByRole('heading', { level: 2, name: 'Gripe' }).closest('article')!;
    await user.click(within(gripeCard).getByRole('link', { name: /Ver informações completas/i }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Gripe' })).toBeInTheDocument();
    expect(screen.getByText('CID-10: J11')).toBeInTheDocument();
    expect(screen.getByText('Vacinação anual gratuita no SUS')).toBeInTheDocument();
  });

  it('exibe fallback clínico seguro na página de Doenças ao detectar autodiagnóstico ou baixa confiança (US-03.1)', async () => {
    const user = userEvent.setup();
    renderAt('/doencas');

    const input = await screen.findByLabelText('Buscar doença, alergia ou sintoma');
    await user.type(input, 'estou com febre e manchas, o que eu faço');
    await user.click(screen.getByRole('button', { name: 'Pesquisar' }));

    const alert = await screen.findByRole('alert');
    expect(
      within(alert).getByText('Sintomas complexos. Procure uma unidade de saúde.'),
    ).toBeInTheDocument();
  });

  it('redireciona /unidades para /unidades/9990001 e exibe perfil, KPIs, gráfico (463 total), serviços e equipe CNES (US-04.2 a US-04.6)', async () => {
    const user = userEvent.setup();
    renderAt('/unidades');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'UBS República' }),
    ).toBeInTheDocument();

    // Ações nativas (US-04.2)
    expect(screen.getByRole('link', { name: /Ligar/i })).toHaveAttribute(
      'href',
      'tel:+551133330180',
    );
    expect(screen.getByRole('link', { name: /Como chegar/i })).toHaveAttribute(
      'href',
      expect.stringContaining('google.com/maps/dir/'),
    );

    // KPIs (US-04.3)
    const metricsSection = screen.getByLabelText('Indicadores da unidade');
    expect(within(metricsSection).getByText('3.842')).toBeInTheDocument();
    expect(within(metricsSection).getByText('24 min')).toBeInTheDocument();
    expect(within(metricsSection).getByText('Moderado')).toBeInTheDocument();
    expect(within(metricsSection).getByText('18.420')).toBeInTheDocument();

    // Gráfico de 7 dias com soma exata da API = 463 e média = 66 (US-04.4)
    expect(await screen.findByText(/463 atendimentos na semana/i)).toBeInTheDocument();
    expect(screen.getByText('média por dia')).toBeInTheDocument();
    expect(screen.getByLabelText('Qui: 92 atendimentos')).toBeInTheDocument();

    // Serviços e filtro por categoria (US-04.5)
    expect(screen.getByRole('heading', { level: 3, name: 'Clínica geral' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Vacinação' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Prevenção' }));
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { level: 3, name: 'Clínica geral' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { level: 3, name: 'Vacinação' })).toBeInTheDocument();

    // Equipe e estrutura CNES com data oficial (US-04.6)
    expect(screen.getByText(/Dados oficiais do CNES • Competência 2025-05/i)).toBeInTheDocument();
    expect(screen.getByText('32')).toBeInTheDocument();
    expect(screen.getByText('profissionais')).toBeInTheDocument();

    // Seletor de unidade alterna para UBS Sé (9990002)
    await user.selectOptions(screen.getByLabelText('Selecionar unidade'), '9990002');
    expect(await screen.findByRole('heading', { level: 2, name: 'UBS Sé' })).toBeInTheDocument();
    expect(await screen.findByText('3.190')).toBeInTheDocument();
  });

  it('exibe tag "Estimativa baseada em histórico" quando o e-SUS em tempo real falha (US-04.3 caso de borda)', async () => {
    window.sessionStorage.setItem('brchain.mockScenario', 'estimate');
    renderAt('/unidades/9990001');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'UBS República' }),
    ).toBeInTheDocument();
    const tags = await screen.findAllByText('Estimativa baseada em histórico');
    expect(tags.length).toBeGreaterThanOrEqual(1);
  });
});
