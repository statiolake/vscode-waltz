import type { TextEditor } from 'vscode';
import type { CommentConfigProvider } from './utils/comment';
import type { VimState } from './vimState';

/**
 * すべての操作で共通のコンテキスト
 * Motion, TextObject, Actionすべてで使用される
 */
export type Context = {
    readonly editor: TextEditor | undefined;
    readonly vimState: VimState;
    readonly commentConfigProvider: CommentConfigProvider;
};
