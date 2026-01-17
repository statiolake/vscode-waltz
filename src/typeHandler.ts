import * as vscode from 'vscode';

import type { Context } from './context';
import { globalCommentConfigProvider } from './extension';
import type { VimState } from './vimState';

export async function typeHandler(vimState: VimState, char: string): Promise<void> {
    // editor が undefined でも処理を継続 (big file fallback のため)
    const editor = vscode.window.activeTextEditor;

    // type が発生した場合に即行う処理はキューイング。後は Mutex が空くのを待ってから処理してくれればいいので、バックグ
    // ラウンドに投げるだけ投げてさっさと handler は終わってしまう。
    // ここで、少なくともタイプしたキーの数だけ Mutex を待っているタスクがある状態になるので、一回の Mutex 内で一文字以
    // 上 keysQueued を処理すれば、処理しきれずに止まってしまうことはない。
    vimState.keysQueued.push(char);
    void vimState.actionMutex.use(async () => {
        // そうでなければ先頭から一文字取り出して処理する。
        const char = vimState.keysQueued.shift();
        if (!char) {
            // 基本的には一文字ずつ処理するので、呼び出し回数とキーの数は一致しており、何かしら処理対象のキーがある場合
            // が多い。ただ、上記のように insert モードに入ったことでまとめてキーを処理した場合は、それ以降のハンドラ呼
            // び出しではもう処理するべきキーが残っていないことがあるので、その場合は何も考えずに終了する。
            return;
        }

        // In other modes, add to pressed keys and try to execute actions
        vimState.keysPressed.push(char);

        const context: Context = {
            editor,
            vimState,
            commentConfigProvider: globalCommentConfigProvider,
        };

        // Try to execute an action
        let executed = false;
        let needsMore = false;

        for (const action of vimState.actions) {
            const result = await action(context, vimState.keysPressed);

            if (result === 'executed') {
                executed = true;
                break;
            } else if (result === 'needsMoreKey') {
                needsMore = true;
            }
        }

        if (executed) {
            // If an action was executed, clear the keys
            vimState.keysPressed = [];
        } else if (!needsMore) {
            // No action matched and no action needs more input, clear the keys
            vimState.keysPressed = [];
        }
    });
}
