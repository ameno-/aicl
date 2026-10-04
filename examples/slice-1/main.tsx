import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { Gallery } from './Gallery.js';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
const view = new URLSearchParams(window.location.search).get('view');
createRoot(root).render(view === 'gallery' ? <Gallery /> : <App />);
