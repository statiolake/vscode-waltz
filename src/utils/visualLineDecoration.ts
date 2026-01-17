import * as vscode from 'vscode';
import { Range, type TextEditor } from 'vscode';

// Visual Line モード用の decoration type
// 選択範囲と同じ背景色で行全体をハイライトする
let visualLineDecorationType: vscode.TextEditorDecorationType | undefined;

function getDecorationType(): vscode.TextEditorDecorationType {
    if (!visualLineDecorationType) {
        visualLineDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('editor.selectionBackground'),
        });
    }
    return visualLineDecorationType;
}

/**
 * Visual Line モードの decoration を更新する
 * 現在の selection の行全体をハイライトする（各行のテキスト末尾まで）
 */
export function updateVisualLineDecoration(editor: TextEditor): void {
    const decorationType = getDecorationType();

    // 各 selection の行範囲を計算（各行を個別に Range として追加）
    const ranges: Range[] = [];
    for (const selection of editor.selections) {
        const startLine = Math.min(selection.anchor.line, selection.active.line);
        const endLine = Math.max(selection.anchor.line, selection.active.line);
        for (let line = startLine; line <= endLine; line++) {
            const lineText = editor.document.lineAt(line).text;
            ranges.push(new Range(line, 0, line, lineText.length));
        }
    }

    editor.setDecorations(decorationType, ranges);
}

/**
 * Visual Line モードの decoration をクリアする
 */
export function clearVisualLineDecoration(editor: TextEditor | undefined): void {
    if (!editor || !visualLineDecorationType) return;
    editor.setDecorations(visualLineDecorationType, []);
}

/**
 * decoration type を破棄する（拡張機能の deactivate 時に呼ぶ）
 */
export function disposeVisualLineDecoration(): void {
    if (visualLineDecorationType) {
        visualLineDecorationType.dispose();
        visualLineDecorationType = undefined;
    }
}
