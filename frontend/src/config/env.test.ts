import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from './env';

describe('parseEnv', () => {
  it('aplica padrões seguros quando nada é informado (modo mock)', () => {
    const env = parseEnv({});
    expect(env.VITE_DATA_MODE).toBe('mock');
    expect(env.isMock).toBe(true);
    expect(env.apiBaseUrl).toBe('/api/v1');
    expect(env.VITE_REQUEST_TIMEOUT_MS).toBe(8000);
    expect(env.VITE_DEFAULT_CITY_IBGE).toBe('3550308');
  });

  it('trata strings vazias como ausentes', () => {
    const env = parseEnv({ VITE_REQUEST_TIMEOUT_MS: '', VITE_API_URL: '  ' });
    expect(env.VITE_REQUEST_TIMEOUT_MS).toBe(8000);
    expect(env.VITE_API_URL).toBeUndefined();
  });

  it('em modo api usa VITE_API_URL (sem barra final) + /api/v1', () => {
    const env = parseEnv({ VITE_DATA_MODE: 'api', VITE_API_URL: 'http://localhost:8000/' });
    expect(env.apiBaseUrl).toBe('http://localhost:8000/api/v1');
    expect(env.isMock).toBe(false);
  });

  it('em modo api sem URL usa a mesma origem (proxy)', () => {
    expect(parseEnv({ VITE_DATA_MODE: 'api' }).apiBaseUrl).toBe('/api/v1');
  });

  it('em modo mock ignora VITE_API_URL (MSW intercepta na mesma origem)', () => {
    const env = parseEnv({ VITE_DATA_MODE: 'mock', VITE_API_URL: 'http://localhost:8000' });
    expect(env.apiBaseUrl).toBe('/api/v1');
  });

  it('falha cedo com mensagens claras para valores inválidos', () => {
    try {
      parseEnv({
        VITE_DATA_MODE: 'prod',
        VITE_API_URL: 'localhost:8000',
        VITE_DEFAULT_CITY_IBGE: '355',
      });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EnvError);
      const issues = (e as EnvError).issues.join('\n');
      expect(issues).toMatch(/VITE_DATA_MODE/);
      expect(issues).toMatch(/VITE_API_URL/);
      expect(issues).toMatch(/VITE_DEFAULT_CITY_IBGE/);
    }
  });
});
