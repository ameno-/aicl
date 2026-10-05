import { createRoot } from 'react-dom/client';
import '@aicl/styles';
import { ChatPanel } from './ChatPanel.tsx';
import { Scratchpad } from './Scratchpad.tsx';
import './styles.css';

function App() {
  return (
    <div className="workspace">
      <main className="canvas" aria-label="Scratchpad">
        <Scratchpad />
      </main>
      <ChatPanel />
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
createRoot(root).render(<App />);
