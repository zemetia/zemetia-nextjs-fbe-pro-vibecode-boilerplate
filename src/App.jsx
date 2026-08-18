import React, { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import { getPage, getPageTitle, DEFAULT_PAGE_ID } from './config/pages';

export default function App() {
  const [activePage, setActivePage] = useState(DEFAULT_PAGE_ID);

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
