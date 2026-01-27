import * as vscode from 'vscode';
import { Position, Selection } from 'vscode';
import { enterMode } from '../modes';
import type { VimState } from '../vimState';

/**
 * 編集コマンド (Visual モード c、ペースト、段落移動など)
 */

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

async function changeToEndOfLine(vimState: VimState): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Delete to end of line
    await vscode.commands.executeCommand('deleteAllRight');

    // Enter insert mode
    enterMode(vimState, editor, 'insert');
}

async function deleteChar(_vimState: VimState): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Delete the character after cursor position (between cursor and next position)
    await editor.edit((editBuilder) => {
        for (const selection of editor.selections) {
            if (selection.isEmpty) {
                const line = editor.document.lineAt(selection.active.line);
                if (selection.active.character < line.text.length) {
                    const charRange = new vscode.Range(selection.active, selection.active.translate(0, 1));
                    editBuilder.delete(charRange);
                }
            } else {
                editBuilder.delete(selection);
            }
        }
    });
}

async function substituteChar(vimState: VimState): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Delete the character after cursor position
    await deleteChar(vimState);

    // Enter insert mode
    enterMode(vimState, editor, 'insert');
}

async function deleteToEnd(_vimState: VimState): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Delete to end of line
    await vscode.commands.executeCommand('deleteAllRight');
}

/**
 * Find paragraph boundary (first or last non-empty line of current paragraph)
 * - 'up': find first non-empty line of current paragraph (or previous paragraph if already at start)
 * - 'down': find last non-empty line of current paragraph (or next paragraph if already at end)
 */
function findParagraphBoundary(document: vscode.TextDocument, startLine: number, direction: 'up' | 'down'): number {
    const lineCount = document.lineCount;
    let line = startLine;

    // If on empty line, first find a paragraph in the given direction
    if (document.lineAt(line).isEmptyOrWhitespace) {
        while (line >= 0 && line < lineCount) {
            if (!document.lineAt(line).isEmptyOrWhitespace) break;
            line += direction === 'up' ? -1 : 1;
        }
        // If we went out of bounds, clamp
        if (line < 0 || line >= lineCount) {
            return Math.max(0, Math.min(lineCount - 1, line));
        }
    }

    // Now we're on a non-empty line, find the boundary of this paragraph
    if (direction === 'up') {
        // Find first non-empty line of paragraph (go up until empty or start)
        while (line > 0 && !document.lineAt(line - 1).isEmptyOrWhitespace) {
            line--;
        }
        // If we're already at the start and haven't moved, go to previous paragraph
        if (line === startLine && line > 0) {
            line--;
            // Skip empty lines
            while (line > 0 && document.lineAt(line).isEmptyOrWhitespace) {
                line--;
            }
            // Find start of that paragraph
            while (line > 0 && !document.lineAt(line - 1).isEmptyOrWhitespace) {
                line--;
            }
        }
    } else {
        // Find last non-empty line of paragraph (go down until empty or end)
        while (line < lineCount - 1 && !document.lineAt(line + 1).isEmptyOrWhitespace) {
            line++;
        }
        // If we're already at the end and haven't moved, go to next paragraph
        if (line === startLine && line < lineCount - 1) {
            line++;
            // Skip empty lines
            while (line < lineCount - 1 && document.lineAt(line).isEmptyOrWhitespace) {
                line++;
            }
            // Find end of that paragraph
            while (line < lineCount - 1 && !document.lineAt(line + 1).isEmptyOrWhitespace) {
                line++;
            }
        }
    }

    return line;
}

function paragraphMove(_vimState: VimState, direction: 'up' | 'down', select: boolean): void {
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
        vscode.commands.registerCommand('waltz.visualChange', () => visualChange(getVimState())),
        vscode.commands.registerCommand('waltz.changeToEndOfLine', () => changeToEndOfLine(getVimState())),
        vscode.commands.registerCommand('waltz.deleteChar', () => deleteChar(getVimState())),
        vscode.commands.registerCommand('waltz.substituteChar', () => substituteChar(getVimState())),
        vscode.commands.registerCommand('waltz.deleteToEnd', () => deleteToEnd(getVimState())),
        vscode.commands.registerCommand('waltz.paragraphUp', () => paragraphMove(getVimState(), 'up', false)),
        vscode.commands.registerCommand('waltz.paragraphDown', () => paragraphMove(getVimState(), 'down', false)),
        vscode.commands.registerCommand('waltz.paragraphUpSelect', () => paragraphMove(getVimState(), 'up', true)),
        vscode.commands.registerCommand('waltz.paragraphDownSelect', () => paragraphMove(getVimState(), 'down', true)),
    );
}
