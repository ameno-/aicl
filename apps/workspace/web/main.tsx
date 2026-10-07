import { createRoot } from 'react-dom/client';
import '@aicl/styles';
import { Shell } from './shell/Shell.tsx';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
createRoot(root).render(<Shell />);
