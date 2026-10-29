import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22 }}>Página não encontrada</h1>
      <p>
        <Link to="/">Voltar para o início</Link>
      </p>
    </main>
  );
}
