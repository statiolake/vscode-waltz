import { Mutex } from 'await-semaphore';
import type { StatusBarItem } from 'vscode';
import * as vscode from 'vscode';
import { buildActions } from './action/actions';
import { CommentConfigProvider } from './utils/comment';
import type { VimState } from './vimState';

/**
 * Create a VimState with proper initialization
 * @param statusBarItem StatusBarItem for displaying mode (optional for tests)
 * @returns Initialized VimState
 */
export function createVimState(statusBarItem?: StatusBarItem): VimState {
    return {
        statusBarItem: statusBarItem ?? createDummyStatusBarItem(),
        actionMutex: new Mutex(),
        mode: 'insert',
        keysQueued: [],
        keysPressed: [],
        actions: buildActions(),
        register: {
            contents: [],
            lastClipboardText: '',
        },
        keptColumn: null,
        lastFt: undefined,
    };
}

/**
 * Create a CommentConfigProvider
 * @returns Initialized CommentConfigProvider
 */
export function createCommentConfigProvider(): CommentConfigProvider {
    return new CommentConfigProvider();
}

/**
 * Create a dummy StatusBarItem for testing
 * This creates a minimal StatusBarItem that satisfies the interface but doesn't actually display anything
 */
function createDummyStatusBarItem(): StatusBarItem {
    return {
        alignment: vscode.StatusBarAlignment.Left,
        priority: 100,
        text: '',
        tooltip: undefined,
        color: undefined,
        backgroundColor: undefined,
        command: undefined,
        accessibilityInformation: undefined,
        name: 'Waltz Test',
        id: 'waltz-test',
        show: () => {},
        hide: () => {},
        dispose: () => {},
    };
}
