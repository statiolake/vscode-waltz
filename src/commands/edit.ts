import * as vscode from 'vscode';
import { Position, Selection } from 'vscode';
import { enterMode } from '../modes';
import type { VimState } from '../vimState';

/**
 * 編集コマンド (Visual モード d/c/y、ペースト、段落移動など)
 */

async function visualDelete(vimState: VimState): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Copy selection to clipboard
    await vscode.commands.executeCommand('editor.action.clipboardCopyAction');

    // Delete selection
    await editor.edit((editBuilder) => {
        for (const selection of editor.selections) {
            editBuilder.delete(selection);
        }
    });

    // Return to normal mode
    enterMode(vimState, editor, 'normal');
}

async function visualChange(vimState: VimState): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Copy selection to clipboard
    await vscode.commands.executeCommand('editor.action.clipboardCopyAction');

    // Delete selection and enter insert mode
    await editor.edit((editBuilder) => {
        for (const selection of editor.selections) {
            editBuilder.delete(selection);
        }
    });

    // Enter insert mode
    enterMode(vimState, editor, 'insert');
}

async function visualYank(vimState: VimState): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Copy selection to clipboard
    await vscode.commands.executeCommand('editor.action.clipboardCopyAction');

    // Collapse selection to start
    editor.selections = editor.selections.map((selection) => new Selection(selection.start, selection.start));

    // Return to normal mode
    enterMode(vimState, editor, 'normal');
}

async function pasteAfter(_vimState: VimState): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Move cursor right first (paste after cursor)
    if (editor.selection.isEmpty) {
        await vscode.commands.executeCommand('cursorRight');
    }

    // Paste
    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
}

async function pasteBefore(_vimState: VimState): Promise<void> {
    // Just paste at cursor position
    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
}

async function changeToEndOfLine(vimState: VimState): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Delete to end of line
    await vscode.commands.executeCommand('deleteAllRight');

    // Enter insert mode
    enterMode(vimState, editor, 'insert');
}

function findParagraphBoundary(
    document: vscode.TextDocument,
    startLine: number,
    direction: 'up' | 'down',
): number {
    const lineCount = document.lineCount;
    let line = startLine;

    // Skip current paragraph (non-empty lines)
    while (line >= 0 && line < lineCount) {
        if (document.lineAt(line).isEmptyOrWhitespace) break;
        line += direction === 'up' ? -1 : 1;
    }

    // Skip empty lines
    while (line >= 0 && line < lineCount) {
        if (!document.lineAt(line).isEmptyOrWhitespace) break;
        line += direction === 'up' ? -1 : 1;
    }

    // Clamp to valid range
    return Math.max(0, Math.min(lineCount - 1, line));
}

function paragraphMove(vimState: VimState, direction: 'up' | 'down', select: boolean): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    editor.selections = editor.selections.map((selection) => {
        const targetLine = findParagraphBoundary(editor.document, selection.active.line, direction);
        const targetPos = new Position(targetLine, 0);

        if (select) {
            return new Selection(selection.anchor, targetPos);
        }
        return new Selection(targetPos, targetPos);
    });

    // Reveal cursor
    editor.revealRange(editor.selection);
}

export function registerEditCommands(context: vscode.ExtensionContext, getVimState: () => VimState): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.visualDelete', () => visualDelete(getVimState())),
        vscode.commands.registerCommand('waltz.visualChange', () => visualChange(getVimState())),
        vscode.commands.registerCommand('waltz.visualYank', () => visualYank(getVimState())),
        vscode.commands.registerCommand('waltz.pasteAfter', () => pasteAfter(getVimState())),
        vscode.commands.registerCommand('waltz.pasteBefore', () => pasteBefore(getVimState())),
        vscode.commands.registerCommand('waltz.changeToEndOfLine', () => changeToEndOfLine(getVimState())),
        vscode.commands.registerCommand('waltz.paragraphUp', () => paragraphMove(getVimState(), 'up', false)),
        vscode.commands.registerCommand('waltz.paragraphDown', () => paragraphMove(getVimState(), 'down', false)),
        vscode.commands.registerCommand('waltz.paragraphUpSelect', () => paragraphMove(getVimState(), 'up', true)),
        vscode.commands.registerCommand('waltz.paragraphDownSelect', () => paragraphMove(getVimState(), 'down', true)),
    );
}
