// Class names for the chat elements, as Tailwind utilities over the --aicl-* theme variables.
export const C = {
  thread: 'flex flex-col gap-[inherit] min-h-0',
  message: 'flex flex-col gap-2 min-w-0 data-[role=user]:items-end',
  bubble: 'max-w-[80%] px-3.5 py-2 rounded-[var(--aicl-radius-lg)] bg-[var(--aicl-bubble-user)] whitespace-pre-wrap [overflow-wrap:anywhere]',
  markdown:
    'leading-relaxed [overflow-wrap:anywhere] [&>:first-child]:mt-0 [&>:last-child]:mb-0 [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:mb-2 [&_ol]:pl-5 [&_ol]:list-decimal [&_h3]:font-semibold [&_h4]:font-semibold [&_a]:text-[var(--aicl-accent)] [&_a]:underline [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:px-1 [&_code]:rounded-[var(--aicl-radius-sm)] [&_code]:bg-[var(--aicl-surface-inset)] [&_pre]:mb-2 [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-[var(--aicl-border)] [&_pre]:rounded-[var(--aicl-radius-md)] [&_pre]:bg-[var(--aicl-surface-inset)] [&_pre_code]:p-0 [&_pre_code]:bg-transparent',
  reasoning: 'group text-[13px] text-[var(--aicl-text-muted)]',
  tool: 'group text-[13px] text-[var(--aicl-text-muted)] data-[status=error]:text-red-600',
  summary: 'inline-flex items-center gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden',
  dot: 'size-[7px] shrink-0 rounded-full bg-[var(--aicl-text-faint)] data-[status=success]:bg-green-600 data-[status=error]:bg-red-600 data-[status=running]:bg-[var(--aicl-accent)] data-[status=running]:animate-pulse data-[status=pending]:bg-[var(--aicl-accent)] data-[status=pending]:animate-pulse group-data-[streaming]:bg-[var(--aicl-accent)] group-data-[streaming]:animate-pulse',
  detailBody: 'mt-1.5 ml-4 pl-2.5 border-l-2 border-[var(--aicl-border)] whitespace-pre-wrap',
  detailCode: 'mt-1.5 ml-4 pl-2.5 border-l-2 border-[var(--aicl-border)] whitespace-pre-wrap font-mono text-xs',
  artifact: 'flex items-center gap-2.5 px-3 py-2.5 border border-[var(--aicl-border)] rounded-[var(--aicl-radius-md)] bg-[var(--aicl-surface)]',
  artifactKind: 'px-2 py-px rounded-full text-[11px] uppercase tracking-wide bg-[var(--aicl-surface-inset)] text-[var(--aicl-text-muted)]',
  artifactTitle: 'flex-1 min-w-0 truncate font-semibold',
  artifactVersion: 'text-xs text-[var(--aicl-text-muted)]',
  error: 'flex items-center gap-2.5 px-3 py-2 border border-red-300 rounded-[var(--aicl-radius-md)] text-red-600 text-[13px] [&_button]:ml-auto',
  status: 'text-[13px] text-[var(--aicl-text-faint)]',
  pending: 'inline-flex items-center gap-2 text-[13px] text-[var(--aicl-text-muted)]',
  composer: 'box-border flex flex-col gap-2 w-full max-w-[760px] mx-auto px-4 pb-4 data-[variant=hero]:p-0',
  chips: 'flex flex-wrap gap-1.5',
  chip: 'px-2.5 py-1 border border-[var(--aicl-border)] rounded-full bg-[var(--aicl-surface)] text-[var(--aicl-text)] text-[13px] cursor-pointer',
  input:
    'flex items-end gap-2 py-2 pr-2 pl-3.5 border border-[var(--aicl-border)] rounded-[var(--aicl-radius-xl)] bg-[var(--aicl-surface)] shadow-sm focus-within:border-[color-mix(in_srgb,var(--aicl-accent)_45%,var(--aicl-border))]',
  textarea: 'flex-1 min-h-6 max-h-[200px] py-1 border-0 outline-none resize-none bg-transparent text-[var(--aicl-text)] [font:inherit] leading-normal',
  send: 'grid place-items-center size-8 shrink-0 border-0 rounded-full bg-[var(--aicl-accent)] text-[var(--aicl-accent-fg)] text-[15px] cursor-pointer disabled:opacity-35 disabled:cursor-default',
};
