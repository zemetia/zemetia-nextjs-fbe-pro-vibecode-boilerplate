import React, { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import { getPage, getPageTitle, DEFAULT_PAGE_ID } from './config/pages';

export default function App() {
  const [activePage, setActivePage] = useState(DEFAULT_PAGE_ID);

  const page = getPage(activePage) || getPage(DEFAULT_PAGE_ID);
  const PageComponent = page.component;

  return (
    <div className="app-container">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div className="main-content">
        <Navbar pageTitle={getPageTitle(activePage)} />
        <PageComponent setActivePage={setActivePage} />
      </div>
    </div>
  );
}
