import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useState } from 'react';
import OryxaLogo from '../OryxaLogo';

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-bg">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div className="relative z-10 flex min-h-screen">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="flex-1 flex flex-col min-w-0 lg:ml-72">
          {/* Topbar mobile */}
          <div className="lg:hidden sticky top-0 z-30 glass px-4 py-3 flex items-center justify-between">
            <button
              className="btn-icon"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <OryxaLogo size={30} nameClassName="font-bold text-lg text-[#0a0a0c] dark:text-white" imageClassName="rounded-lg" />
            <div className="w-9" />
          </div>

          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
            <Outlet />
          </main>

          <footer className="text-center text-xs text-gray-400 dark:text-gray-500 py-6">
            © {new Date().getFullYear()} Oryxa — Facturation simple pour PME africaines.
          </footer>
        </div>
      </div>
    </div>
  );
}
