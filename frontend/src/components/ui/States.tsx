import type { CSSProperties } from 'react';
import { isApiError } from '../../api/client';
import type { ProvenanceMeta } from '../../api/types';

export function Skeleton({ style }: { style?: CSSProperties }) {
  return <div className="skeleton" aria-busy="true" aria-label="Carregando" style={style} />;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="state-box" role="status">
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  fallbackTitle = 'Não foi possível carregar estas informações',
}: {
  error: unknown;
  onRetry?: () => void;
  fallbackTitle?: string;
}) {
  const message = isApiError(error)
    ? error.message
    : error instanceof Error
      ? error.message
      : 'Tente novamente em alguns instantes.';
  return (
    <div className="state-box" role="alert">
      <strong>{fallbackTitle}</strong>
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function ProvenanceTags({ meta }: { meta?: ProvenanceMeta }) {
  if (!meta) return null;
  return (
    <>
      {meta.is_estimate && (
        <span className="provenance-tag" role="status">
          Estimativa baseada em histórico
        </span>
      )}
      {meta.is_stale && (
        <span className="provenance-tag" role="status">
          Dados em cache — atualização pendente
        </span>
      )}
    </>
  );
}
