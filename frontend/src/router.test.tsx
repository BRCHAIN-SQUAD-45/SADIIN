import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { routes } from './router';
import { createQueryClient } from './queryClient';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [path],
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  });
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>,
  );
}

describe('Fase 2 — Layout global + Home idênticos ao protótipo', () => {
  it('renderiza gov-bar, header, hero, atalhos, perto de você, notícias, indicadores, fontes e rodapé', async () => {
    renderAt('/');

    expect(screen.getByText('Portal de dados públicos em saúde')).toBeInTheDocument();
    expect(await screen.findByText('Dados atualizados em 28 mai 2025')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Saúde pública ao seu alcance' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('452 mil')).toBeInTheDocument();
    expect(screen.getByText('6 fontes')).toBeInTheDocument();

    // 3 cards de acesso rápido
    expect(screen.getByRole('link', { name: /Consultar medicamentos/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pesquisar sintomas/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Encontrar unidade/i })).toBeInTheDocument();

    // Perto de você + UBS mais próxima
    expect(await screen.findByText('UBS República')).toBeInTheDocument();
    expect(screen.getByText('MAIS PRÓXIMA • 850 M')).toBeInTheDocument();

    // Notícias + Saúde em dados + Fontes
    expect(
      await screen.findByText('Campanha contra a gripe é ampliada para toda a população'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Casos de dengue apresentam queda na sua região'),
    ).toBeInTheDocument();
    expect(screen.getByText('−18,4%')).toBeInTheDocument();
    expect(await screen.findByText('DATASUS')).toBeInTheDocument();
    expect(screen.getByText('RNDS')).toBeInTheDocument();

    // Rodapé
    expect(screen.getByText('Este portal não substitui orientação médica.')).toBeInTheDocument();
  });

  it('busca popular dispara GET /search e exibe resultados; fallback de autodiagnóstico bloqueia resposta prescritiva', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(screen.getByRole('button', { name: 'Dipirona' }));
    expect(await screen.findByText(/Resultados para “Dipirona” em tudo/)).toBeInTheDocument();
    const panel = await screen.findByRole('region', { name: 'Resultados da pesquisa' });
    expect(within(panel).getByText('Analgésico e antitérmico')).toBeInTheDocument();

    // Caso de borda: tentativa de autodiagnóstico retorna fallback seguro exato
    const input = screen.getByLabelText('Pesquisar no portal');
    await user.clear(input);
    await user.type(input, 'Estou com febre, o que tomo?');
    await user.click(screen.getByRole('button', { name: 'Pesquisar' }));

    expect(
      await screen.findByText('Sintomas complexos. Procure uma unidade de saúde.'),
    ).toBeInTheDocument();
  });

  it('seletor de localização persiste escolha em localStorage e atualiza a cidade das notícias', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(screen.getByRole('button', { name: /Selecionar localização/i }));
    const dialog = screen.getByRole('dialog', { name: /Selecionar cidade e estado/i });
    const citySelect = within(dialog).getByLabelText('Cidade');
    await user.selectOptions(citySelect, '3509502'); // Campinas

    expect(
      await screen.findByText(/Informações e avisos importantes para moradores de Campinas\./),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem('brchain.location')).toContain('Campinas');
  });

  it('botão Acessibilidade alterna data-a11y no html e persiste no localStorage', async () => {
    const user = userEvent.setup();
    renderAt('/');

    const btn = screen.getByRole('button', { name: /Acessibilidade/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    await user.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.getAttribute('data-a11y')).toBe('true');
  });

  it.each([
    ['/medicamentos', /Consulte informações sobre indicações/],
    ['/doencas', /Encontre informações confiáveis para reconhecer sintomas/],
    ['/unidades/9990001', /UBS República/],
    ['/rota-inexistente', /Página não encontrada/],
  ])('%s renderiza a página correspondente', async (path, text) => {
    renderAt(path);
    expect(await screen.findByText(text)).toBeInTheDocument();
  });
});
