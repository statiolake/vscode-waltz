import type { TextEditor } from 'vscode';
import * as vscode from 'vscode';
import { registerTypeCommand, unregisterTypeCommand } from './extension';
import type { Mode } from './modesTypes';
import { getCursorStyleForMode } from './utils/cursorStyle';
import { getModeDisplayText } from './utils/modeDisplay';
import { collapseSelections } from './utils/selection';
import type { VimState } from './vimState';

export async function enterMode(vimState: VimState, editor: TextEditor | undefined, mode: Mode): Promise<void> {
    const oldMode = vimState.mode;
    vimState.mode = mode;

    // Visual モードに入るときは入室時刻を記録
    if (mode === 'visual' && oldMode !== 'visual') {
        vimState.visualModeEnteredAt = Date.now();
    } else if (mode !== 'visual') {
        vimState.visualModeEnteredAt = undefined;
    }

    // insert モードに入るときは type コマンドを解除し、出るときは登録する
    if (mode === 'insert' && oldMode !== 'insert') {
        unregisterTypeCommand(vimState);
    } else if (mode !== 'insert' && oldMode === 'insert') {
        registerTypeCommand(vimState);
    }

    reinitUiForState(vimState, editor);

    // 選択範囲の調整は重たく副作用も大きいので、明示的に指定されない限りスキップする
    // モードが実際に変わった場合のみ行う
    if (oldMode === mode) return;

    if (vimState.mode === 'normal' && editor && editor.selections.some((selection) => !selection.isEmpty)) {
        // ノーマルモードに入ったら、選択範囲を解除する
        // 副作用を避けるため、不要な場合 (どれも空の場合) は実行しないようにしておく。
        // たとえば undo などは以下のようなフローをたどるため、最終的なカーソル位置が先祖返りすることがある。
        // 1. undo コマンド実行
        // 2. テキスト部分が戻る (カーソルはまだ戻っていないのでずれている)
        // 3. onDidChangeTextDocument 発行 (カーソルはずれている)
        //     -> ここでノーマルモードに入る (ずれた位置にカーソルセットを試みる)
        // 4. 先に？ undo コマンドの後続処理でカーソル位置も復元される
        // 5. 3 でセットした位置が遅れて反映され、結果としてカーソル位置がずれる
        // どういうわけかわからないが、こういう順番で不整合が起きてしまうっぽい。
        // これ自体はイベント発火の仕組みなのかな。とりあえず避けられそうにないので、影響を最小化するため不必要な場合
        // はセットしないようにしておく。
        await collapseSelections(editor);
    }
}

function reinitUiForState(vimState: VimState, editor: TextEditor | undefined) {
    updateModeContext(vimState.mode);
    updateCursorStyle(editor, vimState.mode);
    updateStatusBar(vimState, vimState.mode, editor === undefined);
}

function updateModeContext(mode: Mode) {
    vscode.commands.executeCommand('setContext', 'waltz.mode', mode);
}

function updateCursorStyle(editor: TextEditor | undefined, mode: Mode): void {
    if (!editor) return;
    editor.options.cursorStyle = getCursorStyleForMode(mode);
}

function updateStatusBar(vimState: VimState, mode: Mode, isLimited: boolean): void {
    const { statusBarItem } = vimState;
    if (!statusBarItem) return;

    statusBarItem.text = getModeDisplayText(mode, isLimited);
    statusBarItem.show();
}
