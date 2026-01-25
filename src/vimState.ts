import type { Disposable, StatusBarItem } from 'vscode';
import type { Mode } from './modesTypes';

/**
 * Waltz state (mutated during operation)
 */
export type VimState = {
    mode: Mode;
    statusBarItem: StatusBarItem;

    /** Last f/t/F/T command for repeat with ; and , */
    lastFt?: {
        character: string;
        distance: 'nearer' | 'further';
        direction: 'before' | 'after';
    };

    /**
     * type command Disposable.
     * Set to null in insert mode to allow VS Code native input handling.
     */
    typeCommandDisposable: Disposable | null;
};
