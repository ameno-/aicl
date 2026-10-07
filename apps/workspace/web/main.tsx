import { createRoot } from 'react-dom/client';
import '@aicl/styles';
import './tailwind.css';
import { FxProvider } from '@aicl/fx';
import { Shell } from './shell/Shell.tsx';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
createRoot(root).render(
  <FxProvider>
    <Shell />
  </FxProvider>,
);
