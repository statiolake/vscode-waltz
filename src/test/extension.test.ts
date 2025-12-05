import type { TextEditor } from 'vscode';
import type { Context } from '../context';
import { createVimState } from '../contextInitializers';
import { CommentConfigProvider } from '../utils/comment';

/**
 * テスト用のContextを作成するヘルパー関数
 * @param editor TextEditor
 * @param options オプション設定
 * @param options.vimState VimState (省略時は新規に作成)
 * @param options.commentConfigProvider CommentConfigProvider (省略時は新規に作成)
 */
export function createTestContext(editor: TextEditor): Context {
    return {
        editor,
        vimState: createVimState(),
        commentConfigProvider: new CommentConfigProvider(),
    };
}
