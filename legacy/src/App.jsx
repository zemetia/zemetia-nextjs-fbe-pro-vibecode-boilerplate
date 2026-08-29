import React, { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import { getPage, getPageTitle, DEFAULT_PAGE_ID } from './config/pages';

// Mengekstrak ID halaman dari window.location.pathname (misal '/import-trading' -> 'import-trading')
const getPageIdFromLocation = () => {
  if (typeof window === 'undefined') return DEFAULT_PAGE_ID;

  // 1. Bersihkan sisa hash lama bila ada (misal '#/import-trading' atau '#dashboard')
  const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
  if (rawHash && getPage(rawHash)) {
    return rawHash;
  }

  // 2. Ambil dari path URL murni (misal '/purchase-request' -> 'purchase-request')
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '').trim();
  if (!path || path === 'index.html') return DEFAULT_PAGE_ID;

  return getPage(path) ? path : DEFAULT_PAGE_ID;
};

export default function App() {
  const [activePage, setActivePageState] = useState(() => getPageIdFromLocation());

  // Navigasi halaman: update URL path murni tanpa tanda pagar (#)
  const setActivePage = (pageId) => {
    if (!pageId) return;
    const targetPath = `/${pageId}`;
    if (window.location.pathname !== targetPath || window.location.hash) {
      window.history.pushState({ pageId }, '', targetPath);
    }
    setActivePageState(pageId);
  };

  useEffect(() => {
    // Bersihkan URL saat inisialisasi bila terdapat sisa hash atau format path yang salah
    const initialPage = getPageIdFromLocation();
    const cleanPath = `/${initialPage}`;
    if (window.location.hash || (window.location.pathname !== cleanPath && window.location.pathname !== '/')) {
      window.history.replaceState({ pageId: initialPage }, '', cleanPath);
    }

    const handlePopState = () => {
      const pageId = getPageIdFromLocation();
      setActivePageState(pageId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const page = getPage(activePage) || getPage(DEFAULT_PAGE_ID);
  const PageComponent = page.component;

  return (
    <div className="flex min-h-screen">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div className="ml-[260px] min-w-0 flex-1 px-8 py-6">
        <Navbar pageTitle={getPageTitle(activePage)} />
        <PageComponent setActivePage={setActivePage} />
      </div>
    </div>
  );
}
