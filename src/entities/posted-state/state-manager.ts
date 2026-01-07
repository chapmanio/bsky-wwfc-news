/**
 * State manager for KV storage operations
 */

import { PostedState, SourceState, SourceKey, DEFAULT_STATE, DEFAULT_SOURCE_STATE } from './types';

/** KV key for storing the state */
const STATE_KEY = 'posted-state';

/** Maximum number of posted IDs to keep per source (to prevent unbounded growth) */
const MAX_POSTED_IDS = 1000;

/**
 * Create a state manager for interacting with KV storage
 */
export function createStateManager(kv: KVNamespace) {
  return {
    /**
     * Get the current state from KV
     */
    async getState(): Promise<PostedState> {
      const stored = await kv.get<PostedState>(STATE_KEY, 'json');
      return stored ?? DEFAULT_STATE;
    },

    /**
     * Save the state to KV
     */
    async saveState(state: PostedState): Promise<void> {
      await kv.put(STATE_KEY, JSON.stringify(state));
    },

    /**
     * Get state for a specific source
     */
    async getSourceState(source: SourceKey): Promise<SourceState> {
      const state = await this.getState();
      return state[source] ?? DEFAULT_SOURCE_STATE;
    },

    /**
     * Check if an item has already been posted
     */
    async isPosted(source: SourceKey, itemId: string): Promise<boolean> {
      const sourceState = await this.getSourceState(source);
      return sourceState.postedIds.includes(itemId);
    },

    /**
     * Mark an item as posted
     */
    async markAsPosted(source: SourceKey, itemId: string): Promise<void> {
      const state = await this.getState();
      const sourceState = state[source];

      // Add the item ID, keeping only the most recent MAX_POSTED_IDS
      sourceState.postedIds = [itemId, ...sourceState.postedIds].slice(0, MAX_POSTED_IDS);
      sourceState.lastCheckedAt = new Date().toISOString();
      sourceState.consecutiveFailures = 0;

      await this.saveState(state);
    },

    /**
     * Mark multiple items as posted at once
     */
    async markManyAsPosted(source: SourceKey, itemIds: string[]): Promise<void> {
      const state = await this.getState();
      const sourceState = state[source];

      // Add all item IDs, keeping only the most recent MAX_POSTED_IDS
      sourceState.postedIds = [...itemIds, ...sourceState.postedIds].slice(0, MAX_POSTED_IDS);
      sourceState.lastCheckedAt = new Date().toISOString();
      sourceState.consecutiveFailures = 0;

      await this.saveState(state);
    },

    /**
     * Record a failure for a source
     */
    async recordFailure(source: SourceKey): Promise<number> {
      const state = await this.getState();
      const sourceState = state[source];

      sourceState.consecutiveFailures += 1;
      sourceState.lastCheckedAt = new Date().toISOString();

      await this.saveState(state);

      return sourceState.consecutiveFailures;
    },

    /**
     * Reset failure count for a source
     */
    async resetFailures(source: SourceKey): Promise<void> {
      const state = await this.getState();
      state[source].consecutiveFailures = 0;
      await this.saveState(state);
    },

    /**
     * Get consecutive failure count for a source
     */
    async getFailureCount(source: SourceKey): Promise<number> {
      const sourceState = await this.getSourceState(source);
      return sourceState.consecutiveFailures;
    },

    /**
     * Filter out already posted items from a list
     */
    async filterNewItems<T extends { id: string }>(source: SourceKey, items: T[]): Promise<T[]> {
      const sourceState = await this.getSourceState(source);
      const postedSet = new Set(sourceState.postedIds);
      return items.filter((item) => !postedSet.has(item.id));
    },
  };
}

/**
 * Type for the state manager
 */
export type StateManager = ReturnType<typeof createStateManager>;
