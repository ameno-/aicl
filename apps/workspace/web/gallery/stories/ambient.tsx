import { Ambient } from '@aicl/fx';
import type { ReactNode } from 'react';
import type { Story } from '../types.ts';

const box = (node: ReactNode) => <div className="relative h-40 overflow-hidden rounded-lg">{node}</div>;

export default {
  group: 'Ambient',
  title: 'Ambient',
  note: 'WebGPU background for hero, idle and working states; CSS fallback without WebGPU.',
  states: {
    idle: () => box(<Ambient mood="idle" />),
    working: () => box(<Ambient mood="working" />),
    error: () => box(<Ambient mood="error" />),
  },
} satisfies Story;
