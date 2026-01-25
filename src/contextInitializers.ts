import type { StatusBarItem } from 'vscode';
import * as vscode from 'vscode';
import { CommentConfigProvider } from './utils/comment';
import type { VimState } from './vimState';

/**
 * Create a VimState with proper initialization
 * @param statusBarItem StatusBarItem for displaying mode (optional for tests)
 * @returns Initialized VimState
 */
export function createVimState(statusBarItem?: StatusBarItem): VimState {
    return {
        mode: 'insert',
        statusBarItem: statusBarItem ?? createDummyStatusBarItem(),
        lastFt: undefined,
        typeCommandDisposable: null,
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
