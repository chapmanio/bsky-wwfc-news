/**
 * Posted state types for KV storage
 */

/**
 * State stored for each source
 */
export interface SourceState {
  /** IDs of items that have been posted */
  postedIds: string[];

  /** Timestamp of last state update (only when content was posted or errors occurred) */
  lastUpdatedAt: string;

  /** Count of consecutive failures */
  consecutiveFailures: number;
}

/**
 * Complete state stored in KV
 */
export interface PostedState {
  youtube: SourceState;
  wwfcNews: SourceState;
}

/**
 * Source keys for state management
 */
export type SourceKey = keyof PostedState;

/**
 * Default state for a new source
 */
export const DEFAULT_SOURCE_STATE: SourceState = {
  postedIds: [],
  lastUpdatedAt: new Date(0).toISOString(),
  consecutiveFailures: 0,
};

/**
 * Default state for the entire bot
 */
export const DEFAULT_STATE: PostedState = {
  youtube: { ...DEFAULT_SOURCE_STATE },
  wwfcNews: { ...DEFAULT_SOURCE_STATE },
};
