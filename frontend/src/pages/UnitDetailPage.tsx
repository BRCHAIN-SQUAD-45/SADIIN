import { useParams } from 'react-router-dom';

/** PROVISÓRIO (Fase 1). Detalhe da UBS entra na Fase 3. */
export function UnitDetailPage() {
  const { cnes } = useParams();
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22 }}>Unidades de saúde (placeholder)</h1>
      <p>CNES: {cnes ?? '— (será a UBS mais próxima)'}</p>
    </main>
  );
}
