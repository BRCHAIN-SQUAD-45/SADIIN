import { useEffect } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { Footer } from './Footer';
import { GovBar } from './GovBar';
import { Header } from './Header';

export function Layout() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = hash.replace(/^#/, '');
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
    return () => clearTimeout(timer);
  }, [hash, pathname]);

  return (
    <div className="portal">
      <GovBar />
      <Header />
      <Outlet />
      <Footer />
      <ScrollRestoration />
    </div>
  );
}
