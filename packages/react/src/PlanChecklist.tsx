export interface PlanItem {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export function PlanChecklist({ items }: { items: PlanItem[] }) {
  const done = items.filter((item) => item.status === 'done').length;
  return (
    <div data-aicl="plan-checklist" data-count={items.length} data-progress={`${done}/${items.length}`}>
      <p aria-live="polite">
        {done}/{items.length}
      </p>
      <ol>
        {items.map((item) => (
          <li key={item.id} data-status={item.status}>
            {item.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
