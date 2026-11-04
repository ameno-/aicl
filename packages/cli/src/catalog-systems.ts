import type { CatalogItem } from './types.js';

const file = (path: string, type: CatalogItem['type'], target?: string) =>
  target ? { path, type, target } : { path, type };

/** Systems, hooks, and shared libs. Installable on their own. */
export const systemItems: readonly CatalogItem[] = [
  {
    name: 'token-contract',
    title: 'Token contract',
    type: 'registry:theme',
    description: 'Every visual decision as a named custom property, plus the primitive surfaces.',
    package: '@aicl/styles',
    files: [
      file('packages/styles/src/contract.css', 'registry:theme'),
      file('packages/styles/src/components.css', 'registry:theme'),
      file('packages/styles/src/index.css', 'registry:theme'),
      file('packages/styles/src/reset.css', 'registry:theme'),
    ],
    registryDependencies: [],
    dependencies: [],
    categories: ['theme'],
    usage: `import '@aicl/styles';`,
    npmImport: `import '@aicl/styles';`,
    docs: 'docs/components/token-contract.md',
  },
  {
    name: 'looseleaf',
    title: 'LooseLeaf skin',
    type: 'registry:theme',
    description: 'Paper on a desk. Values only: no JavaScript, so it cannot change behaviour.',
    package: '@aicl/styles',
    files: [file('packages/styles/src/themes/looseleaf.css', 'registry:theme')],
    registryDependencies: ['token-contract'],
    dependencies: [],
    categories: ['theme'],
    usage: `import '@aicl/styles';
import '@aicl/styles/themes/looseleaf.css';`,
    npmImport: `import '@aicl/styles/themes/looseleaf.css';`,
    docs: 'docs/components/looseleaf.md',
  },
  {
    name: 'motion',
    title: 'Motion system',
    type: 'registry:lib',
    description: 'Three spring tiers, their exits, fluid hover, and weight without reflow.',
    package: '@aicl/motion',
    files: [
      file('packages/motion/src/springs.ts', 'registry:lib', 'lib/aicl/springs.ts'),
      file('packages/motion/src/easing.ts', 'registry:lib', 'lib/aicl/easing.ts'),
      file('packages/motion/src/geometry.ts', 'registry:lib', 'lib/aicl/geometry.ts'),
      file('packages/motion/src/weight.ts', 'registry:lib', 'lib/aicl/weight.ts'),
      file('packages/motion/src/motion.css', 'registry:lib'),
    ],
    registryDependencies: ['token-contract'],
    dependencies: [],
    categories: ['system'],
    usage: `import '@aicl/motion/motion.css';
import { useFluidHover, FluidHoverHighlight, WeightText } from '@aicl/motion/react';`,
    npmImport: `import '@aicl/motion/motion.css';`,
    docs: 'docs/components/motion.md',
  },
  {
    name: 'icon-slots',
    title: 'Icon slots',
    type: 'registry:lib',
    description: 'Icons looked up by role, swappable through one provider. A primitive never imports an icon.',
    package: '@aicl/react',
    files: [file('packages/react/src/icons.tsx', 'registry:lib', 'components/aicl/icons.tsx')],
    registryDependencies: [],
    dependencies: ['lucide-react', 'react'],
    categories: ['system'],
    usage: `import { Icon, IconProvider } from '@aicl/react';

<IconProvider icons={{ send: MySend }}>
  <Icon name="send" />
</IconProvider>`,
    npmImport: `import { Icon, IconProvider } from '@aicl/react';`,
    docs: 'docs/components/icon-slots.md',
  },
  {
    name: 'cn',
    title: 'cn',
    type: 'registry:lib',
    description: 'clsx + tailwind-merge. The `@aicl/fx` components compose class names through it.',
    package: '@aicl/fx',
    files: [file('packages/fx/src/lib/cn.ts', 'registry:lib', 'components/aicl/fx/lib/cn.ts')],
    registryDependencies: [],
    dependencies: ['clsx', 'tailwind-merge'],
    categories: ['system'],
    usage: `import { cn } from '@aicl/fx';`,
    npmImport: `import { cn } from '@aicl/fx';`,
    docs: 'docs/components/cn.md',
  },
  {
    name: 'fx-provider',
    title: 'FxProvider',
    type: 'registry:lib',
    description: 'Sets motion reducedMotion="user" and the data-fx scope vendored components assume.',
    package: '@aicl/fx',
    files: [file('packages/fx/src/lib/FxProvider.tsx', 'registry:lib', 'components/aicl/fx/lib/FxProvider.tsx')],
    registryDependencies: ['cn'],
    dependencies: ['motion', 'react'],
    categories: ['system'],
    usage: `import { FxProvider } from '@aicl/fx';

<FxProvider>{children}</FxProvider>`,
    npmImport: `import { FxProvider } from '@aicl/fx';`,
    docs: 'docs/components/fx-provider.md',
  },
  {
    name: 'use-chat',
    title: 'useChat',
    type: 'registry:hook',
    description: 'Binds a ChatController to React. Status, messages, send, stop, and the streaming id.',
    package: '@aicl/react',
    files: [file('packages/react/src/useChat.ts', 'registry:hook', 'hooks/use-chat.ts')],
    registryDependencies: [],
    dependencies: ['react', '@aicl/core'],
    categories: ['hook'],
    usage: `import { useChat } from '@aicl/react';
import { createSseTransport } from '@aicl/core';

const chat = useChat({ transport: createSseTransport({ url: '/api/chat' }) });`,
    npmImport: `import { useChat } from '@aicl/react';`,
    docs: 'docs/components/use-chat.md',
  },
  {
    name: 'use-readable',
    title: 'useReadable',
    type: 'registry:hook',
    description: 'Subscribe a React component to a core store without pulling the store into the tree.',
    package: '@aicl/react',
    files: [file('packages/react/src/useReadable.ts', 'registry:hook', 'components/aicl/useReadable.ts')],
    registryDependencies: [],
    dependencies: ['react', '@aicl/core'],
    categories: ['hook'],
    usage: `import { useReadable } from '@aicl/react';

const toasts = useReadable(queue.state);`,
    npmImport: `import { useReadable } from '@aicl/react';`,
    docs: 'docs/components/use-readable.md',
  },
  {
    name: 'use-fluid-hover',
    title: 'useFluidHover',
    type: 'registry:hook',
    description: 'One travelling highlight per list. The nearest-item rule is a pure function.',
    package: '@aicl/motion',
    files: [file('packages/motion/src/react.tsx', 'registry:hook', 'lib/aicl/react.tsx')],
    registryDependencies: ['motion'],
    dependencies: ['react'],
    categories: ['hook'],
    usage: `import { useFluidHover, FluidHoverHighlight } from '@aicl/motion/react';

const hover = useFluidHover();
<nav ref={hover.containerRef} {...hover.handlers}>
  <FluidHoverHighlight hover={hover} />
</nav>`,
    npmImport: `import { useFluidHover, FluidHoverHighlight } from '@aicl/motion/react';`,
    docs: 'docs/components/use-fluid-hover.md',
  },
];
