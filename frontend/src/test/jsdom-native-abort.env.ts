import type { Environment } from 'vitest/environments';
import { builtinEnvironments } from 'vitest/environments';

/**
 * Ambiente jsdom que preserva AbortController/AbortSignal nativos do Node.
 *
 * Motivo: o jsdom substitui esses globais pelos seus, mas o `fetch` nativo (undici)
 * rejeita sinais que não são instâncias do AbortSignal do Node
 * ("Expected signal to be an instance of AbortSignal"). No navegador isso não ocorre.
 */
const env: Environment = {
  name: 'jsdom-native-abort',
  transformMode: 'web',
  async setup(global, options) {
    const NativeAbortController = global.AbortController;
    const NativeAbortSignal = global.AbortSignal;
    const jsdom = await builtinEnvironments.jsdom.setup(global, options);
    global.AbortController = NativeAbortController;
    global.AbortSignal = NativeAbortSignal;
    return jsdom;
  },
};

export default env;
