/** One file a registry item copies into the consumer. */
export interface RegistryFile {
  path: string;
  type: RegistryType;
  target?: string;
  content?: string;
}

export type RegistryType =
  | 'registry:ui'
  | 'registry:lib'
  | 'registry:hook'
  | 'registry:theme'
  | 'registry:item';

/**
 * A catalog item. The generated `registry.json` is the shadcn-shaped
 * rendering of this; the extra fields (slots, states, usage, npmImport)
 * are AICL's, so an agent can install a component without reading source.
 */
export interface CatalogItem {
  name: string;
  title: string;
  type: RegistryType;
  description: string;
  package: string;
  files: readonly RegistryFile[];
  registryDependencies: readonly string[];
  dependencies: readonly string[];
  categories: readonly string[];
  usage: string;
  npmImport: string;
  slots?: readonly string[];
  states?: Readonly<Record<string, readonly string[]>>;
  docs: string;
}

export interface PrimitiveExtra {
  category: string;
  registryDependencies?: readonly string[];
  dependencies?: readonly string[];
  usage: string;
  npmImport?: string;
}

export interface PrimitiveLike {
  name: string;
  summary: string;
  source: readonly string[];
  slots: readonly string[];
  states?: Readonly<Record<string, readonly string[]>>;
}
