import type { Range, TextEditor } from 'vscode';
import * as vscode from 'vscode';
import { enterMode } from '../modes';
import { collapseSelections } from '../utils/selection';
import type { VimState } from '../vimState';

interface OperatorArgs {
    selectCommand?: string;
    line?: boolean;
}

/**
 * S (cc) の native コマンドシーケンス実装。editor が取れない (巨大ファイル等) ときの
 * フォールバック。clipboardCut → reindent の 2 edit で undo step が 2 個になる点、
 * および空行で clipboardCut の "empty selection = cut whole line" 副作用により行ごと
 * 消える点が不満だが、それは executeChangeLineViaEdit 側で直す。
 */
export async function executeChangeLineNative(vimState: VimState): Promise<void> {
    await vscode.commands.executeCommand('cursorLineStart');
    await vscode.commands.executeCommand('cursorEndSelect');
    await vscode.commands.executeCommand('editor.action.clipboardCutAction');
    await vscode.commands.executeCommand('editor.action.reindentselectedlines');
    await enterMode(vimState, vscode.window.activeTextEditor, 'insert');
}

/**
 * S (cc) の editor.edit() 版。中身の削除を editor.edit で 1 edit に閉じ込める。
 * reindent は独立 action のため undo step 数は native と同じ 2 になるが、
 * 空行での clipboardCut 副作用 (行ごと削除) を回避できるのが利点。
 *
 * native 版との意図的な差分:
 *   - 空行 (行内容が "") ではコンテンツ削除を実質 no-op にし、行を保持する。
 *     clipboard もその分は書き換えない。
 */
export async function executeChangeLineViaEdit(vimState: VimState, editor: TextEditor): Promise<void> {
    const doc = editor.document;
    const lineRanges: Range[] = [];
    const texts: string[] = [];
    for (const sel of editor.selections) {
        const line = doc.lineAt(sel.active.line);
        lineRanges.push(line.range);
        texts.push(line.text);
    }

    // 行の中身を削除。空行は replace("", "") で実質 no-op。
    await editor.edit((editBuilder) => {
        for (const range of lineRanges) {
            editBuilder.replace(range, '');
        }
    });

    // 削除した行の内容を clipboard へ。空行しかない場合は clipboard を汚染しない。
    const nonEmptyTexts = texts.filter((t) => t.length > 0);
    if (nonEmptyTexts.length > 0) {
        await vscode.env.clipboard.writeText(nonEmptyTexts.join('\n'));
    }

    await vscode.commands.executeCommand('editor.action.reindentselectedlines');
    await enterMode(vimState, editor, 'insert');
}

async function executeDelete(vimState: VimState, args: OperatorArgs): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    await collapseSelections(editor);

    if (args.line) {
        await vscode.commands.executeCommand('editor.action.clipboardCutAction');
        await enterMode(vimState, editor, 'normal');
    } else {
        if (!args.selectCommand) return;

        try {
            await vscode.commands.executeCommand(args.selectCommand);
        } catch {
            return;
        }

        await vscode.commands.executeCommand('editor.action.clipboardCutAction');
        await enterMode(vimState, editor, 'normal');
    }
}

async function executeChange(vimState: VimState, args: OperatorArgs): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    await collapseSelections(editor);

    if (args.line) {
        if (editor) {
            await executeChangeLineViaEdit(vimState, editor);
        } else {
            await executeChangeLineNative(vimState);
        }
    } else {
        if (!args.selectCommand) return;

        try {
            await vscode.commands.executeCommand(args.selectCommand);
        } catch {
            return;
        }

        await vscode.commands.executeCommand('editor.action.clipboardCutAction');
        await enterMode(vimState, editor, 'insert');
    }
}

async function executeYank(vimState: VimState, args: OperatorArgs): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    await collapseSelections(editor);

    if (args.line) {
        await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
        await collapseSelections(editor);
        await enterMode(vimState, editor, 'normal');
    } else {
        if (!args.selectCommand) return;

        try {
            await vscode.commands.executeCommand(args.selectCommand);
        } catch {
            return;
        }

        await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
        await collapseSelections(editor);
        await enterMode(vimState, editor, 'normal');
    }
}

export function registerOperatorCommands(context: vscode.ExtensionContext, getVimState: () => VimState): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.delete', (args: OperatorArgs = {}) =>
            executeDelete(getVimState(), args),
        ),
        vscode.commands.registerCommand('waltz.change', (args: OperatorArgs = {}) =>
            executeChange(getVimState(), args),
        ),
        vscode.commands.registerCommand('waltz.yank', (args: OperatorArgs = {}) => executeYank(getVimState(), args)),
    );
}
