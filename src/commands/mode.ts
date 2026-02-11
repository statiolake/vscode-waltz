import * as vscode from 'vscode';
import { enterMode } from '../modes';
import type { VimState } from '../vimState';

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
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                await vscode.commands.executeCommand('cursorHome');
            }
            enterMode(getVimState(), editor, 'insert');
        }),
    );

    // A - Insert mode at line end
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterInsertAtLineEnd', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                await vscode.commands.executeCommand('cursorEnd');
            }
            enterMode(getVimState(), editor, 'insert');
        }),
    );

    // o - Insert mode on new line below
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterInsertAtNewLineBelow', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                await vscode.commands.executeCommand('editor.action.insertLineAfter');
            }
            enterMode(getVimState(), editor, 'insert');
        }),
    );

    // O - Insert mode on new line above
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterInsertAtNewLineAbove', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                await vscode.commands.executeCommand('editor.action.insertLineBefore');
            }
            enterMode(getVimState(), editor, 'insert');
        }),
    );

    // v - Visual mode
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterVisual', () => {
            const editor = vscode.window.activeTextEditor;
            enterMode(getVimState(), editor, 'visual');
        }),
    );

    // i in Visual mode - Insert at start of selection
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterInsertAtSelectionStart', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                // Move cursor to start of each selection
                editor.selections = editor.selections.map((selection) => {
                    const start = selection.start;
                    return new vscode.Selection(start, start);
                });
            }
            enterMode(getVimState(), editor, 'insert');
        }),
    );

    // a in Visual mode - Insert at end of selection
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterInsertAtSelectionEnd', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                // Move cursor to end of each selection
                editor.selections = editor.selections.map((selection) => {
                    const end = selection.end;
                    return new vscode.Selection(end, end);
                });
            }
            enterMode(getVimState(), editor, 'insert');
        }),
    );
}
