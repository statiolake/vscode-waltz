import { Selection, type TextEditor } from 'vscode';

/**
 * マルチカーソル状態の選択範囲をゼロ幅に戻す。editor が取得できないときは何もしない
 */
export async function collapseSelections(editor: TextEditor | undefined): Promise<void> {
    if (!editor) return;
    if (editor.selections.every((selection) => selection.isEmpty)) return;
    editor.selections = editor.selections.map((selection) => new Selection(selection.active, selection.active));
}
