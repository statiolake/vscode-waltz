import * as vscode from 'vscode';
import { enterMode } from '../modes';
import type { VimState } from '../vimState';

/**
 * モード切替コマンド
 */
export function registerModeCommands(context: vscode.ExtensionContext, getVimState: () => VimState): void {
    // i/a - Insert mode at cursor (I-beam model: i and a are the same)
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterInsert', () => {
            const editor = vscode.window.activeTextEditor;
            enterMode(getVimState(), editor, 'insert');
        }),
    );

    // I - Insert mode at line start
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterInsertLineStart', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                await vscode.commands.executeCommand('cursorHome');
            }
            enterMode(getVimState(), editor, 'insert');
        }),
    );

    // A - Insert mode at line end
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterInsertLineEnd', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                await vscode.commands.executeCommand('cursorEnd');
            }
            enterMode(getVimState(), editor, 'insert');
        }),
    );

    // o - Insert mode on new line below
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterInsertNewLineBelow', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                await vscode.commands.executeCommand('editor.action.insertLineAfter');
            }
            enterMode(getVimState(), editor, 'insert');
        }),
    );

    // O - Insert mode on new line above
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterInsertNewLineAbove', async () => {
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

    // V - Visual line (select line)
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.enterVisualLine', async () => {
            const editor = vscode.window.activeTextEditor;
            await vscode.commands.executeCommand('expandLineSelection');
            enterMode(getVimState(), editor, 'visual');
        }),
    );
}
