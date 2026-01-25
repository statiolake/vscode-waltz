import { createVimState } from '../contextInitializers';
import type { VimState } from '../vimState';

/**
 * Create a VimState for testing
 * @param options Optional VimState to use instead of creating a new one
 */
export function createTestVimState(options?: { vimState?: VimState }): VimState {
    return options?.vimState ?? createVimState();
}
