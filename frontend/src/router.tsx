import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { DirectoryPage } from './pages/DirectoryPage';
import { MedicationDetailPage } from './pages/MedicationDetailPage';
import { ConditionDetailPage } from './pages/ConditionDetailPage';
import { UnitDetailPage } from './pages/UnitDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';

/**
 * Rotas (SPA, sem recarregar a página):
 *   /                    Início
 *   /medicamentos        Medicamentos (listagem + busca + filtros)
 *   /medicamentos/:id    Detalhe do medicamento (bula resumida)
 *   /doencas             Doenças e sintomas (listagem + busca + filtros)
 *   /doencas/:id         Detalhe da doença/sintoma (prevenção e cuidado)
 *   /unidades            Unidades de saúde (redireciona para a primeira UBS)
 *   /unidades/:cnes      Detalhe da unidade
 */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'medicamentos', element: <DirectoryPage kind="medications" /> },
      { path: 'medicamentos/:id', element: <MedicationDetailPage /> },
      { path: 'doencas', element: <DirectoryPage kind="conditions" /> },
      { path: 'doencas/:id', element: <ConditionDetailPage /> },
      { path: 'unidades', element: <UnitDetailPage /> },
      { path: 'unidades/:cnes', element: <UnitDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes, {
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});
