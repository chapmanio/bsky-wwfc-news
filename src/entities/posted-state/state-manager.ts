/**
 * State manager for KV storage operations
 *
 * OPTIMIZED: Uses single read/write pattern to minimize KV operations.
 * - Read state once at the start of each run
 * - Make all changes in memory
 * - Write once at the end, only if something changed
 */

import { PostedState, SourceState, SourceKey, DEFAULT_STATE, DEFAULT_SOURCE_STATE } from './types';

/** KV key for storing the state */
const STATE_KEY = 'posted-state';

/** Maximum number of posted IDs to keep per source (to prevent unbounded growth) */
const MAX_POSTED_IDS = 1000;

/**
 * Create a state manager for interacting with KV storage
 *
 * This manager supports two modes:
 * 1. Direct mode (legacy): Each operation reads/writes to KV
 * 2. Batch mode (optimized): Load state once, modify in memory, save once
 */
export function createStateManager(kv: KVNamespace) {
  /** Cached state for batch operations */
  let cachedState: PostedState | null = null;

  /** Track if state has been modified since loading */
  let isDirty = false;

  return {
    /**
     * Get the current state from KV (or cache if already loaded)
     */
    async getState(): Promise<PostedState> {
      if (cachedState) {
        return cachedState;
      }
      const stored = await kv.get<PostedState>(STATE_KEY, 'json');
      cachedState = stored ?? structuredClone(DEFAULT_STATE);
      return cachedState;
    },

    /**
     * Load state into cache for batch operations
     * Returns the state for immediate use
     */
    async loadState(): Promise<PostedState> {
      const stored = await kv.get<PostedState>(STATE_KEY, 'json');
      cachedState = stored ?? structuredClone(DEFAULT_STATE);
      isDirty = false;
      return cachedState;
    },

    /**
     * Save the cached state to KV (only if modified)
     * Returns true if state was saved, false if no changes
     */
    async saveIfDirty(): Promise<boolean> {
      if (!isDirty || !cachedState) {
        console.log('KV: No changes to save');
        return false;
      }
      await kv.put(STATE_KEY, JSON.stringify(cachedState));
      isDirty = false;
      console.log('KV: State saved');
      return true;
    },

    /**
     * Force save the state to KV
     */
    async saveState(state: PostedState): Promise<void> {
      await kv.put(STATE_KEY, JSON.stringify(state));
      cachedState = state;
      isDirty = false;
    },

    /**
     * Get state for a specific source
     */
    async getSourceState(source: SourceKey): Promise<SourceState> {
      const state = await this.getState();
      return state[source] ?? { ...DEFAULT_SOURCE_STATE };
    },

    /**
     * Check if an item has already been posted (uses cached state)
     */
    isPostedSync(source: SourceKey, itemId: string): boolean {
      if (!cachedState) {
        throw new Error('State not loaded. Call loadState() first.');
      }
      return cachedState[source].postedIds.includes(itemId);
    },

    /**
     * Check if an item has already been posted (async, loads state if needed)
     */
    async isPosted(source: SourceKey, itemId: string): Promise<boolean> {
      const sourceState = await this.getSourceState(source);
      return sourceState.postedIds.includes(itemId);
    },

    /**
     * Mark an item as posted (in memory - call saveIfDirty to persist)
     */
    markAsPostedSync(source: SourceKey, itemId: string): void {
      if (!cachedState) {
        throw new Error('State not loaded. Call loadState() first.');
      }
      const sourceState = cachedState[source];
      sourceState.postedIds = [itemId, ...sourceState.postedIds].slice(0, MAX_POSTED_IDS);
      sourceState.lastUpdatedAt = new Date().toISOString();
      sourceState.consecutiveFailures = 0;
      isDirty = true;
    },

    /**
     * Mark multiple items as posted (in memory - call saveIfDirty to persist)
     */
    markManyAsPostedSync(source: SourceKey, itemIds: string[]): void {
      if (!cachedState) {
        throw new Error('State not loaded. Call loadState() first.');
      }
      if (itemIds.length === 0) return;

      const sourceState = cachedState[source];
      sourceState.postedIds = [...itemIds, ...sourceState.postedIds].slice(0, MAX_POSTED_IDS);
      sourceState.lastUpdatedAt = new Date().toISOString();
      sourceState.consecutiveFailures = 0;
      isDirty = true;
    },

    /**
     * Mark an item as posted (legacy - reads and writes immediately)
     */
    async markAsPosted(source: SourceKey, itemId: string): Promise<void> {
      const state = await this.getState();
      const sourceState = state[source];

      sourceState.postedIds = [itemId, ...sourceState.postedIds].slice(0, MAX_POSTED_IDS);
      sourceState.lastUpdatedAt = new Date().toISOString();
      sourceState.consecutiveFailures = 0;

      await this.saveState(state);
    },

    /**
     * Mark multiple items as posted at once (legacy - reads and writes immediately)
     */
    async markManyAsPosted(source: SourceKey, itemIds: string[]): Promise<void> {
      if (itemIds.length === 0) return;

      const state = await this.getState();
      const sourceState = state[source];

      sourceState.postedIds = [...itemIds, ...sourceState.postedIds].slice(0, MAX_POSTED_IDS);
      sourceState.lastUpdatedAt = new Date().toISOString();
      sourceState.consecutiveFailures = 0;

      await this.saveState(state);
    },

    /**
     * Record a failure for a source (in memory - call saveIfDirty to persist)
     * Returns the new failure count
     */
    recordFailureSync(source: SourceKey): number {
      if (!cachedState) {
        throw new Error('State not loaded. Call loadState() first.');
      }
      cachedState[source].consecutiveFailures += 1;
      cachedState[source].lastUpdatedAt = new Date().toISOString();
      isDirty = true;
      return cachedState[source].consecutiveFailures;
    },

    /**
     * Record a failure for a source (legacy - reads and writes immediately)
     */
    async recordFailure(source: SourceKey): Promise<number> {
      const state = await this.getState();
      const sourceState = state[source];

      sourceState.consecutiveFailures += 1;
      sourceState.lastUpdatedAt = new Date().toISOString();

      await this.saveState(state);

      return sourceState.consecutiveFailures;
    },

    /**
     * Reset failure count for a source (in memory - call saveIfDirty to persist)
     * Only marks dirty if the count was actually non-zero
     */
    resetFailuresSync(source: SourceKey): void {
      if (!cachedState) {
        throw new Error('State not loaded. Call loadState() first.');
      }
      if (cachedState[source].consecutiveFailures > 0) {
        cachedState[source].consecutiveFailures = 0;
        cachedState[source].lastUpdatedAt = new Date().toISOString();
        isDirty = true;
      }
    },

    /**
     * Reset failure count for a source (legacy - reads and writes immediately)
     * @deprecated Use resetFailuresSync + saveIfDirty for better efficiency
     */
    async resetFailures(source: SourceKey): Promise<void> {
      const state = await this.getState();
      if (state[source].consecutiveFailures > 0) {
        state[source].consecutiveFailures = 0;
        state[source].lastUpdatedAt = new Date().toISOString();
        await this.saveState(state);
      }
    },

    /**
     * Get consecutive failure count for a source
     */
    getFailureCountSync(source: SourceKey): number {
      if (!cachedState) {
        throw new Error('State not loaded. Call loadState() first.');
      }
      return cachedState[source].consecutiveFailures;
    },

    /**
     * Get consecutive failure count for a source (async)
     */
    async getFailureCount(source: SourceKey): Promise<number> {
      const sourceState = await this.getSourceState(source);
      return sourceState.consecutiveFailures;
    },

    /**
     * Filter out already posted items from a list (uses cached state)
     */
    filterNewItemsSync<T extends { id: string }>(source: SourceKey, items: T[]): T[] {
      if (!cachedState) {
        throw new Error('State not loaded. Call loadState() first.');
      }
      const postedSet = new Set(cachedState[source].postedIds);

      console.log(`[${source}] Checking ${items.length} items against ${postedSet.size} posted IDs`);

      const newItems = items.filter((item) => {
        const isPosted = postedSet.has(item.id);
        if (isPosted) {
          console.log(`  - ${item.id}: already posted`);
        } else {
          console.log(`  + ${item.id}: NEW`);
        }
        return !isPosted;
      });

      return newItems;
    },

    /**
     * Filter out already posted items from a list (async, loads state if needed)
     */
    async filterNewItems<T extends { id: string }>(source: SourceKey, items: T[]): Promise<T[]> {
      const sourceState = await this.getSourceState(source);
      const postedSet = new Set(sourceState.postedIds);

      console.log(`[${source}] Checking ${items.length} items against ${postedSet.size} posted IDs`);

      const newItems = items.filter((item) => {
        const isPosted = postedSet.has(item.id);
        if (isPosted) {
          console.log(`  - ${item.id}: already posted`);
        } else {
          console.log(`  + ${item.id}: NEW`);
        }
        return !isPosted;
      });

      return newItems;
    },

    /**
     * Clear all state - useful for resetting after config changes
     */
    async clearAllState(): Promise<void> {
      await kv.delete(STATE_KEY);
      cachedState = null;
      isDirty = false;
    },

    /**
     * Check if there are pending changes to save
     */
    hasPendingChanges(): boolean {
      return isDirty;
    },
  };
}

/**
 * Type for the state manager
 */
export type StateManager = ReturnType<typeof createStateManager>;
