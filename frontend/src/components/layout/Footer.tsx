import { useLocation, useNavigate } from 'react-router-dom';

export function Footer() {
  const location = useLocation();
  const navigate = useNavigate();

  const goToHomeAnchor = (hash: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (location.pathname !== '/') {
      navigate(`/#${hash}`);
      return;
    }
    document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="site-footer" id="sobre">
      <div className="section-width footer-content">
        <div className="footer-brand">
          <div className="brand white">
            <span className="brand-symbol">
              <i />
              <i />
              <i />
              <i />
            </span>
            <strong>
              BR<span>chain</span>
            </strong>
          </div>
          <p>Tecnologia para aproximar pessoas de informações públicas de saúde.</p>
        </div>

        <div>
          <strong>Portal</strong>
          <a href="#servicos" onClick={goToHomeAnchor('servicos')}>
            Serviços de saúde
          </a>
          <a href="#indicadores" onClick={goToHomeAnchor('indicadores')}>
            Indicadores
          </a>
          <a href="#fontes" onClick={goToHomeAnchor('fontes')}>
            Fontes de dados
          </a>
        </div>

        <div>
          <strong>Transparência</strong>
          <a href="#sobre" aria-disabled="true" onClick={(e) => e.preventDefault()}>
            Metodologia
          </a>
          <a href="#sobre" aria-disabled="true" onClick={(e) => e.preventDefault()}>
            Privacidade e LGPD
          </a>
          <a href="#sobre" aria-disabled="true" onClick={(e) => e.preventDefault()}>
            Documentação técnica
          </a>
        </div>

        <div className="emergency">
          <strong>Em caso de emergência</strong>
          <p>SAMU</p>
          <span>192</span>
        </div>
      </div>

      <div className="copyright section-width">
        <span>© 2025 BRchain Saúde. Dados públicos para uma saúde mais transparente.</span>
        <span>Este portal não substitui orientação médica.</span>
      </div>
    </footer>
  );
}
