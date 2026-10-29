import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { EnvError, getEnv } from './config/env';
import { App } from './App';
import { BootErrorScreen } from './components/layout/BootErrorScreen';

async function bootstrap() {
  const container = document.getElementById('root');
  if (!container) throw new Error('Elemento #root não encontrado em index.html');
  const root = createRoot(container);

  let env;
  try {
    env = getEnv();
  } catch (err) {
    console.error(err);
    root.render(
      <BootErrorScreen
        title="Configuração inválida"
        message={err instanceof EnvError ? err.issues.join('\n') : String(err)}
        hint="Revise as variáveis VITE_* (veja .env.example) e reinicie o servidor."
      />,
    );
    return;
  }

  if (env.isMock) {
    try {
      const { startMockWorker } = await import('./mocks/browser');
      await startMockWorker();
    } catch (err) {
      console.error('[mock] falha ao iniciar o MSW', err);
      root.render(
        <BootErrorScreen
          title="Não foi possível iniciar os dados de demonstração"
          message={String(err)}
          hint="Verifique se public/mockServiceWorker.js existe (npx msw init public)."
        />,
      );
      return;
    }
  }

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
