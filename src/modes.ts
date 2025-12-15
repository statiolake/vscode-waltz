import * as vscode from 'vscode';
import { Selection, type TextEditor } from 'vscode';
import type { Mode } from './modesTypes';
import { getCursorStyleForMode } from './utils/cursorStyle';
import { getModeDisplayText } from './utils/modeDisplay';
import { expandSelectionsToFullLines } from './utils/visualLine';
import type { VimState } from './vimState';

export async function enterMode(vimState: VimState, editor: TextEditor | undefined, mode: Mode): Promise<void> {
    const oldMode = vimState.mode;
    vimState.mode = mode;

    // 選択範囲の調整はモードが実際に変わった場合のみ行う
    reinitUiForState(vimState, editor, { adjustSelections: oldMode !== mode });
}

/** 現在の状態に応じて UI 要素 (ステータスバー屋カーソルスタイルなど) を再反映する */
export async function reinitUiForState(
    vimState: VimState,
    editor: TextEditor | undefined,
    opts: { adjustSelections?: boolean } = {},
) {
    // UI 関連は念のため常に再反映する
    updateModeContext(vimState.mode);
    updateCursorStyle(editor, vimState.mode);
    updateStatusBar(vimState, vimState.mode);

    // ここから先の処理は重たく副作用も大きいので、明示的に指定されない限りスキップする
    if (!opts.adjustSelections) return;

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
        editor.selections = editor.selections.map((selection) => new Selection(selection.active, selection.active));
    }

    if (vimState.mode === 'visualLine' && editor) {
        // Visual Line モードに入ったら、選択範囲を行全体に拡張する
        expandSelectionsToFullLines(editor);
    }
}

function updateModeContext(mode: Mode) {
    vscode.commands.executeCommand('setContext', 'waltz.mode', mode);
}

function updateCursorStyle(editor: TextEditor | undefined, mode: Mode): void {
    if (!editor) return;
    editor.options.cursorStyle = getCursorStyleForMode(mode);
}

function updateStatusBar(vimState: VimState, mode: Mode): void {
    const { statusBarItem } = vimState;
    if (!statusBarItem) return;

    statusBarItem.text = getModeDisplayText(mode);
    statusBarItem.show();
}
