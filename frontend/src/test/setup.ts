import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from '../mocks/server';

// jsdom não implementa rolagem (usada pelo ScrollRestoration do React Router).
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  window.sessionStorage.clear();
  window.localStorage.clear();
});
afterAll(() => server.close());
