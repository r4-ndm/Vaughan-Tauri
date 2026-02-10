/**
 * dApp Browser Entry Point
 * 
 * Standalone entry point for dApp browser window
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { DappBrowserStandalone } from './views/DappBrowserView/DappBrowserStandalone';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DappBrowserStandalone />
  </React.StrictMode>,
);
