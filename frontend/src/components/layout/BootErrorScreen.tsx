interface Props {
  title: string;
  message: string;
  hint?: string;
}

/** Tela mínima exibida quando a aplicação não consegue inicializar (env inválido, MSW…). */
export function BootErrorScreen({ title, message, hint }: Props) {
  return (
    <main
      role="alert"
      style={{
        fontFamily: '"DM Sans", sans-serif',
        color: '#173d39',
        maxWidth: 640,
        margin: '80px auto',
        padding: 24,
        border: '1px solid #dfeae7',
        borderRadius: 11,
      }}
    >
      <h1 style={{ fontSize: 20, margin: '0 0 12px' }}>{title}</h1>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, background: '#f1f7f5', padding: 12 }}>
        {message}
      </pre>
      {hint && <p style={{ fontSize: 13, color: '#557873' }}>{hint}</p>}
    </main>
  );
}
