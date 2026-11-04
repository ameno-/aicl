import { fxItems } from './catalog-fx.js';
import { primitiveExtras } from './catalog-primitives.js';
import { systemItems } from './catalog-systems.js';
import type { CatalogItem, PrimitiveLike, RegistryFile } from './types.js';

export { fxExportNames, fxItems } from './catalog-fx.js';
export { primitiveExtras } from './catalog-primitives.js';
export { systemItems } from './catalog-systems.js';
export type { CatalogItem, PrimitiveExtra, PrimitiveLike, RegistryFile, RegistryType } from './types.js';

export function kebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function filesForPrimitive(source: readonly string[]): RegistryFile[] {
  const files: RegistryFile[] = source.map((file) => ({
    path: `packages/react/src/${file}`,
    type: 'registry:ui',
    target: `components/aicl/${file}`,
  }));
  if (source.some((file) => file === 'Collapsible.tsx' || file === 'Tabs.tsx' || file === 'Tooltip.tsx')) {
    files.push({
      path: 'packages/react/src/controllable.ts',
      type: 'registry:ui',
      target: 'components/aicl/controllable.ts',
    });
  }
  return files;
}

export function itemsFromPrimitives(primitives: readonly PrimitiveLike[]): CatalogItem[] {
  const missing = primitives.filter((primitive) => !primitiveExtras[primitive.name]);
  if (missing.length > 0) {
    throw new Error(
      `catalog extras missing for: ${missing.map((p) => p.name).join(', ')}`,
    );
  }

  return primitives.map((primitive) => {
    const extra = primitiveExtras[primitive.name]!;
    const name = kebabCase(primitive.name);
    return {
      name,
      title: primitive.name,
      type: 'registry:ui',
      description: primitive.summary,
      package: '@aicl/react',
      files: filesForPrimitive(primitive.source),
      registryDependencies: extra.registryDependencies ?? [],
      dependencies: extra.dependencies ?? ['react', '@aicl/core'],
      categories: [extra.category],
      usage: extra.usage,
      npmImport: extra.npmImport ?? `import { ${primitive.name} } from '@aicl/react';`,
      slots: primitive.slots,
      states: primitive.states,
      docs: `docs/components/${name}.md`,
    } satisfies CatalogItem;
  });
}

/** The full catalog: systems, hooks, primitives, fx. */
export function buildCatalog(primitives: readonly PrimitiveLike[]): CatalogItem[] {
  const items = [...systemItems, ...itemsFromPrimitives(primitives), ...fxItems];
  const names = new Set<string>();
  for (const item of items) {
    if (names.has(item.name)) throw new Error(`duplicate catalog name: ${item.name}`);
    names.add(item.name);
  }
  return items;
}
