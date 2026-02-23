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
        const allCursorsOnLastLine =
            !!editor &&
            editor.selections.length > 0 &&
            editor.selections.every((selection) => selection.active.line === editor.document.lineCount - 1);

        await vscode.commands.executeCommand('editor.action.clipboardCutAction');
        await vscode.commands.executeCommand(
            allCursorsOnLastLine ? 'editor.action.insertLineAfter' : 'editor.action.insertLineBefore',
        );
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
