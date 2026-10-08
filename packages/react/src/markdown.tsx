/**
 * Opt-in Markdown for text parts: `@aicl/react/markdown`.
 *
 * Kept off the main entry so the core adapter ships no parser (ARCHITECTURE
 * non-goal); consumers who want rich replies register it:
 *
 *   createPartRegistry({ ...markdownRenderers })
 *
 * Built on react-markdown + remark-gfm rather than a bespoke parser. Raw HTML
 * is never rendered (react-markdown's default), so model output cannot inject
 * markup. Fenced code renders through the library's `CodeBlock`.
 */

import type { ComponentType } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { TextPart } from '@aicl/core';
import { CodeBlock, type PartProps } from './parts.js';

const components: Components = {
  // Fenced blocks arrive as <pre><code class="language-x">; render them as CodeBlock.
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children, node }) {
    const text = String(children ?? '').replace(/\n$/, '');
    const fenced = node?.position && node.position.start.line !== node.position.end.line;
    const language = /language-([\w-]+)/.exec(className ?? '')?.[1];
    if (fenced || language) return <CodeBlock content={text} language={language} />;
    return <code data-aicl="inline-code">{children}</code>;
  },
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  },
};

export function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  );
}

/** Drop-in renderer for `text` parts. User messages stay verbatim: people do not write Markdown at the model. */
export function MarkdownTextPart({ part, message }: PartProps<TextPart>) {
  if (message.role === 'user') {
    return (
      <div data-aicl="part" data-part="text">
        {part.text}
      </div>
    );
  }
  return (
    <div data-aicl="part" data-part="text" data-format="markdown">
      <Markdown text={part.text} />
    </div>
  );
}

export const markdownRenderers: Record<string, ComponentType<PartProps>> = {
  text: MarkdownTextPart as ComponentType<PartProps>,
};
