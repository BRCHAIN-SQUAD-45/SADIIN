export type DirectoryKind = 'medications' | 'conditions';

/** PROVISÓRIO (Fase 1). Template de Medicamentos / Doenças e sintomas entra na Fase 3. */
export function DirectoryPage({ kind }: { kind: DirectoryKind }) {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22 }}>
        {kind === 'medications' ? 'Medicamentos' : 'Doenças e sintomas'} (placeholder)
      </h1>
    </main>
  );
}
