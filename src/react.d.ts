import type * as React from 'react';
import type { SurfaceDocument, SurfaceNode, SurfaceState, SurfaceStore, SurfaceEvent, JSONValue, SurfaceSnapshot } from './index.js';
export declare function SurfaceProvider(props: {store: SurfaceStore; children?: React.ReactNode}): React.ReactElement;
export declare function useSurface(): SurfaceSnapshot & {
  store: SurfaceStore;
  setState: SurfaceStore['setState'];
  dispatch: SurfaceStore['dispatch'];
  patch: SurfaceStore['patch'];
};
export type CustomSurfaceRenderer = (args: {
  node: SurfaceNode;
  props: Record<string, JSONValue>;
  children: React.ReactNode[];
  state: SurfaceState;
  store: SurfaceStore;
  emit(name: string, payload: JSONValue): void;
}) => React.ReactNode;
export declare function Surface(props: {
  document?: SurfaceDocument;
  store?: SurfaceStore;
  registry?: Record<string, CustomSurfaceRenderer>;
  onEvent?: (event: SurfaceEvent) => void;
  className?: string;
  theme?: 'light' | 'dark';
  empty?: React.ReactNode;
}): React.ReactElement;
