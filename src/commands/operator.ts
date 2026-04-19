import * as vscode from 'vscode';
import { enterMode } from '../modes';
import { collapseSelections } from '../utils/selection';
import type { VimState } from '../vimState';

interface OperatorArgs {
    selectCommand?: string;
    line?: boolean;
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
        // 行そのものは削除せず、中身を選択して切り取ってから再インデントする。
        // 行の削除を伴わないので最終行・単一行などの位置判定が不要になり、
        // editor が取れない巨大ファイルでも挙動が安定する。
        await vscode.commands.executeCommand('cursorLineStart');
        await vscode.commands.executeCommand('cursorEndSelect');
        await vscode.commands.executeCommand('editor.action.clipboardCutAction');
        await vscode.commands.executeCommand('editor.action.reindentselectedlines');
        await enterMode(vimState, editor, 'insert');
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
