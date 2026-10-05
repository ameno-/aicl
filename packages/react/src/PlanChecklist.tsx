import { Circle, CircleCheck, CircleX, LoaderCircle, type LucideIcon } from 'lucide-react';
import { Icon } from './icons.js';

export interface PlanItem {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

const STEP_ICON: Record<PlanItem['status'], LucideIcon> = {
  pending: Circle,
  running: LoaderCircle,
  done: CircleCheck,
  error: CircleX,
};

export function PlanChecklist({ items, title }: { items: PlanItem[]; title?: string }) {
  const done = items.filter((item) => item.status === 'done').length;
  return (
    <div data-aicl="plan-checklist" data-count={items.length} data-progress={`${done}/${items.length}`}>
      <p data-aicl="plan-rollup" aria-live="polite">
        {title ? <span data-aicl="plan-title">{title}</span> : null}
        <span data-aicl="plan-count">
          {done}/{items.length}
        </span>
      </p>
      <ol>
        {items.map((item) => (
          <li key={item.id} data-status={item.status}>
            <Icon as={STEP_ICON[item.status]} spin={item.status === 'running'} />
            <span>{item.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
