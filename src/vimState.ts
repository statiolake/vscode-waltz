import type { Disposable, StatusBarItem } from 'vscode';
import type { Action } from './action/actionTypes';
import type { Mode } from './modesTypes';

/**
 * Vimの状態 (mutableに変更される)
 */
export type VimState = {
    statusBarItem: StatusBarItem;

    mode: Mode;
    keysPressed: string[];
    actions: Action[];
    register: {
        contents: Array<RegisterContent>;
        lastClipboardText: string;
    };

    keptColumn: number | null;
    lastFt:
        | {
              character: string;
              distance: 'nearer' | 'further';
              direction: 'before' | 'after';
          }
        | undefined;

    /**
     * type コマンドの Disposable。
     * insert モードでは null にして VSCode ネイティブの入力処理に任せる。
     */
    typeCommandDisposable: Disposable | null;
};

export type RegisterContent = {
    text: string;
    isLinewise: boolean;
};
