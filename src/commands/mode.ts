import * as vscode from 'vscode';
import { enterMode } from '../modes';
import type { VimState } from '../vimState';

function selectionEndsWithActive(selection: vscode.Selection): boolean {
    return selection.active.isEqual(selection.end);
}

function orientSelection(selection: vscode.Selection, activeEdge: 'start' | 'end'): vscode.Selection {
    if (selection.isEmpty) {
        return selection;
    }

    return activeEdge === 'start'
        ? new vscode.Selection(selection.end, selection.start)
        : new vscode.Selection(selection.start, selection.end);
}

/**
 * モード切替コマンド
 */
export function registerModeCommands(context: vscode.ExtensionContext, getVimState: () => VimState): void {
    // Normal mode
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterNormal', () => {
            const editor = vscode.window.activeTextEditor;
            enterMode(getVimState(), editor, 'normal');
        }),
    );

    // i/a - Insert mode at cursor (I-beam model: i and a are the same)
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterInsert', () => {
            const editor = vscode.window.activeTextEditor;
            enterMode(getVimState(), editor, 'insert');
        }),
    );

    // I - Insert mode at line start
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterInsertAtLineStart', async () => {
            await vscode.commands.executeCommand('cursorHome');
            await enterMode(getVimState(), vscode.window.activeTextEditor, 'insert');
        }),
    );

    // A - Insert mode at line end
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterInsertAtLineEnd', async () => {
            await vscode.commands.executeCommand('cursorEnd');
            await enterMode(getVimState(), vscode.window.activeTextEditor, 'insert');
        }),
    );

    // o - Insert mode on new line below
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterInsertAtNewLineBelow', async () => {
            await vscode.commands.executeCommand('editor.action.insertLineAfter');
            await enterMode(getVimState(), vscode.window.activeTextEditor, 'insert');
        }),
    );

    // O - Insert mode on new line above
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterInsertAtNewLineAbove', async () => {
            await vscode.commands.executeCommand('editor.action.insertLineBefore');
            await enterMode(getVimState(), vscode.window.activeTextEditor, 'insert');
        }),
    );

    // v - Visual mode
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterVisual', () => {
            const editor = vscode.window.activeTextEditor;
            enterMode(getVimState(), editor, 'visual');
        }),
    );

    // <C-g> - Toggle between Visual and Select mode
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.toggleVisualSelect', () => {
            const editor = vscode.window.activeTextEditor;
            const vimState = getVimState();

            if (vimState.mode === 'visual') {
                enterMode(vimState, editor, 'select');
            } else if (vimState.mode === 'select') {
                enterMode(vimState, editor, 'visual');
            }
        }),
    );

    // o in Visual mode - Toggle active edge and align all selections to the primary selection
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.toggleVisualSelectionEnds', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.selections.length === 0) {
                return;
            }

            const primary = editor.selection;
            const nextActiveEdge = selectionEndsWithActive(primary) ? 'start' : 'end';
            editor.selections = editor.selections.map((selection) => orientSelection(selection, nextActiveEdge));
        }),
    );
}
