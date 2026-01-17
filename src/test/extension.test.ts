import type { TextEditor } from 'vscode';
import type { Context } from '../context';
import { createVimState } from '../contextInitializers';
import { CommentConfigProvider } from '../utils/comment';
import type { VimState } from '../vimState';

/**
 * テスト用のContextを作成するヘルパー関数
 * @param editor TextEditor (undefined も可)
 * @param options オプション設定
 * @param options.vimState VimState (省略時は新規に作成)
 */
export function createTestContext(editor: TextEditor | undefined, options?: { vimState?: VimState }): Context {
    return {
        editor,
        vimState: options?.vimState ?? createVimState(),
        commentConfigProvider: new CommentConfigProvider(),
    };
}
