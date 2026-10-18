export declare const SURFACE_VERSION: '1.0';
export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONValue[] | { [key: string]: JSONValue };
export type SurfaceState = Record<string, JSONValue>;
export type SurfaceAction =
  | { type: 'set'; path: string; value: JSONValue }
  | { type: 'toggle'; path: string }
  | { type: 'increment'; path: string; by?: number }
  | { type: 'append'; path: string; value: JSONValue }
  | { type: 'removeAt'; path: string; index: number }
  | { type: 'emit'; name: string; payload?: JSONValue };
export type SurfaceCondition = {
  path: string;
  op?: 'eq' | 'neq' | 'truthy' | 'falsy' | 'gt' | 'gte' | 'lt' | 'lte';
  value?: JSONValue;
};
export interface SurfaceNode {
  type: string;
  id?: string;
  props?: Record<string, JSONValue>;
  bind?: string;
  when?: SurfaceCondition;
  on?: Record<string, SurfaceAction[]>;
  children?: SurfaceNode[];
}
export interface SurfaceDocument {
  version: '1.0';
  title?: string;
  state: SurfaceState;
  root: SurfaceNode;
}
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  nodeCount: number;
}
export interface SurfaceEvent {
  name: string;
  payload: JSONValue;
  state: SurfaceState;
  event?: string;
}
export interface SurfaceSnapshot {
  document: SurfaceDocument;
  state: SurfaceState;
  revision: number;
}
export type SurfacePatch = {op: 'add' | 'remove' | 'replace'; path: string; value?: JSONValue};
export type StreamEvent = {type: 'snapshot'; document: SurfaceDocument} | ({type: 'patch'} & SurfacePatch);
export declare class SurfaceError extends Error { code: string; constructor(message: string, code?: string); }
export declare function isPlainObject(value: unknown): value is Record<string, unknown>;
export declare function safeSegments(path: string): string[];
export declare function readPath<T = JSONValue>(object: unknown, path: string, fallback?: T): T | JSONValue | undefined;
export declare function writePath<T extends SurfaceState>(object: T, path: string, value: JSONValue): T;
export declare function interpolate(template: unknown, state: SurfaceState): string;
export declare function copyJson<T extends JSONValue>(value: T): T;
export declare function validateSurface(input: unknown): ValidationResult;
export declare function assertSurface<T extends SurfaceDocument>(document: T): T;
export declare function evaluateCondition(condition: SurfaceCondition | undefined, state: SurfaceState): boolean;
export declare function patchSurface(document: SurfaceDocument, patch: SurfacePatch): SurfaceDocument;
export interface SurfaceStore {
  getSnapshot(): SurfaceSnapshot;
  subscribe(listener: () => void): () => void;
  setState(path: string, value: JSONValue): void;
  dispatch(action: SurfaceAction, event?: string): void;
  dispatchAll(actions: SurfaceAction[], event?: string): void;
  replaceDocument(document: SurfaceDocument): void;
  patch(patch: SurfacePatch): void;
  applyEvent(event: StreamEvent): void;
}
export declare function createSurfaceStore(initial: SurfaceDocument, options?: {onEvent?: (event: SurfaceEvent) => void}): SurfaceStore;
export declare function createJSONLDecoder(onEvent: (event: StreamEvent) => void, options?: {maxLineBytes?: number}): {
  push(chunk: string): void;
  finish(): void;
};
export declare function surfaceSystemPrompt(): string;
