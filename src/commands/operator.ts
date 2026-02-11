import * as vscode from 'vscode';
import { enterMode } from '../modes';
import { collapseSelections } from '../utils/selection';
import type { VimState } from '../vimState';

interface OperatorArgs {
    selectCommand?: string;
}

async function executeDelete(vimState: VimState, args: OperatorArgs): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    const { selectCommand } = args;
    if (!selectCommand) return;

    await collapseSelections(editor);
    try {
        await vscode.commands.executeCommand(selectCommand);
    } catch {
        return;
    }
    await vscode.commands.executeCommand('editor.action.clipboardCutAction');
    await enterMode(vimState, editor, 'normal');
}

async function executeChange(vimState: VimState, args: OperatorArgs): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    const { selectCommand } = args;
    if (!selectCommand) return;

    await collapseSelections(editor);
    try {
        await vscode.commands.executeCommand(selectCommand);
    } catch {
        return;
    }

    await vscode.commands.executeCommand('editor.action.clipboardCutAction');
    await enterMode(vimState, vscode.window.activeTextEditor, 'insert');
}

async function executeYank(vimState: VimState, args: OperatorArgs): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const { selectCommand } = args;
    if (!selectCommand) return;

    await collapseSelections(editor);
    try {
        await vscode.commands.executeCommand(selectCommand);
    } catch {
        return;
    }
    if (editor.selections.every((selection) => selection.isEmpty)) {
        await collapseSelections(editor);
        return;
    }
    await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
    await collapseSelections(editor);
    await enterMode(vimState, editor, 'normal');
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
