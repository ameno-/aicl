import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { Canvas } from './Canvas.js';
import { Components } from './Components.js';
import { Gallery } from './Gallery.js';
import { Shell } from './Shell.js';
import { ThemeRoot } from './ThemeRoot.js';
import { Tour } from './Tour.js';
import '@aicl/styles';
import '@aicl/styles/themes/looseleaf.css';
import '@aicl/motion/motion.css';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
const view = new URLSearchParams(window.location.search).get('view');
createRoot(root).render(
  <ThemeRoot>
    {view === 'gallery' ? (
      <Gallery />
    ) : view === 'components' ? (
      <Components />
    ) : view === 'canvas' ? (
      <Canvas />
    ) : view === 'scenarios' ? (
      <App />
    ) : view === 'tour' ? (
      <Tour />
    ) : (
      <Shell />
    )}
  </ThemeRoot>,
);
