import { cn } from '../../lib/cn.ts';
import { CopyButton } from '../../vendor/spell-ui/copy-button.tsx';

export interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
}

/** Code surface with a header (filename / language) and an animated copy button. Plain `<pre>`, no highlighter. */
export function CodeBlock({ code, language, filename, className }: CodeBlockProps) {
  return (
    <figure
      data-fx-component="CodeBlock"
      data-language={language}
      className={cn('m-0 overflow-hidden rounded-lg border border-border bg-muted text-sm', className)}
    >
      <figcaption className="flex h-9 items-center gap-2 border-b border-border px-3 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1 truncate font-mono">{filename ?? language ?? 'code'}</span>
        {filename && language ? <span className="uppercase tracking-wide text-faint">{language}</span> : null}
        <CopyButton value={code} size="sm" />
      </figcaption>
      <pre className="m-0 overflow-x-auto p-3 font-mono text-xs leading-5 text-foreground">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
