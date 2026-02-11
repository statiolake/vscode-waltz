import * as vscode from 'vscode';
import { enterMode } from './modes';
import { collapseSelections } from './utils/selection';
import type { VimState } from './vimState';

export async function escapeHandler(vimState: VimState): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    switch (vimState.mode) {
        case 'insert':
            await enterMode(vimState, editor, 'normal');
            break;
        case 'normal':
            await vscode.commands.executeCommand('cancelSelection');
            break;
        case 'visual': {
            await collapseSelections(editor);
            await enterMode(vimState, editor, 'normal');
            break;
        }
    }
}
