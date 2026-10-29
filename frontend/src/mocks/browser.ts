import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

/** Inicia o MSW no navegador (apenas em VITE_DATA_MODE=mock). */
export function startMockWorker() {
  return worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    quiet: import.meta.env.PROD,
    // Tiles do mapa, imagens e fontes passam direto; só avisa sobre /api sem handler.
    onUnhandledRequest(request, print) {
      if (new URL(request.url).pathname.startsWith('/api/')) print.warning();
    },
  });
}
