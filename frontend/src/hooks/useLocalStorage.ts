import { useCallback, useEffect, useState } from 'react';

const SYNC_EVENT = 'brchain:local-storage';

/**
 * Estado sincronizado com `localStorage` e compartilhado entre todos os
 * componentes da mesma aba (via CustomEvent) e entre abas (via `storage`).
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  validate?: (raw: unknown) => T | null,
): [T, (next: T) => void] {
  const read = useCallback((): T => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return initialValue;
      const parsed: unknown = JSON.parse(raw);
      return validate ? (validate(parsed) ?? initialValue) : (parsed as T);
    } catch {
      return initialValue;
    }
  }, [key, initialValue, validate]);

  const [value, setValue] = useState<T>(read);

  useEffect(() => {
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      if (detail?.key === key) setValue(read());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setValue(read());
    };
    window.addEventListener(SYNC_EVENT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, [key, read]);

  const write = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { key } }));
      } catch {
        // storage bloqueado (modo privado restrito etc.) — mantém em memória.
      }
    },
    [key],
  );

  return [value, write];
}
