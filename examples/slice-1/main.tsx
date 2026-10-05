import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { Components } from './Components.js';
import { Gallery } from './Gallery.js';
import { Shell } from './Shell.js';
import { ThemeRoot } from './ThemeRoot.js';
import '@aicl/styles';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
const view = new URLSearchParams(window.location.search).get('view');
createRoot(root).render(
  <ThemeRoot>{view === 'gallery' ? <Gallery /> : view === 'components' ? <Components /> : view === 'scenarios' ? <App /> : <Shell />}</ThemeRoot>,
);
