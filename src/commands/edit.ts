import * as vscode from 'vscode';
import { Position, Selection } from 'vscode';
import { enterMode } from '../modes';
import type { VimState } from '../vimState';

/**
 * Get a character via QuickPick
 */
async function getCharViaQuickPick(prompt: string): Promise<string | null> {
    const quickPick = vscode.window.createQuickPick();
    quickPick.placeholder = prompt;
    quickPick.items = [];

    const char = await new Promise<string>((resolve) => {
        quickPick.onDidChangeValue((value) => {
            if (value.length > 0) {
                quickPick.hide();
                resolve(value[0]);
            }
        });

        quickPick.onDidHide(() => {
            resolve('');
            quickPick.dispose();
        });

        quickPick.show();
    });

    return char || null;
}

/**
 * 編集コマンド (Visual モード c、ペースト、段落移動など)
 */

async function visualChange(vimState: VimState): Promise<void> {
    await vscode.commands.executeCommand('editor.action.clipboardCutAction');
    enterMode(vimState, vscode.window.activeTextEditor, 'insert');
}

async function changeToEndOfLine(vimState: VimState): Promise<void> {
    // Delete to end of line
    await vscode.commands.executeCommand('deleteAllRight');

    // Enter insert mode
    enterMode(vimState, vscode.window.activeTextEditor, 'insert');
}

async function deleteChar(_vimState: VimState): Promise<void> {
    await vscode.commands.executeCommand('deleteRight');
}

async function substituteChar(vimState: VimState): Promise<void> {
    // Delete the character after cursor position
    await vscode.commands.executeCommand('deleteRight');

    // Enter insert mode
    enterMode(vimState, vscode.window.activeTextEditor, 'insert');
}

/**
 * r コマンド：単一文字置換
 * カーソル位置の文字を指定した文字で置換する（ノーマルモードのまま）
 */
async function replaceChar(_vimState: VimState): Promise<void> {
    // QuickPickで置換文字を入力待ち
    const char = await getCharViaQuickPick('Type a character to replace with...');
    if (!char) return;

    await vscode.commands.executeCommand('deleteRight');
    await vscode.commands.executeCommand('default:type', { text: char });
}

async function deleteToEnd(_vimState: VimState): Promise<void> {
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
        vscode.commands.registerCommand('waltz.replaceChar', () => replaceChar(getVimState())),
        vscode.commands.registerCommand('waltz.deleteToEnd', () => deleteToEnd(getVimState())),
        vscode.commands.registerCommand('waltz.paragraphUp', () => paragraphMove(getVimState(), 'up', false)),
        vscode.commands.registerCommand('waltz.paragraphDown', () => paragraphMove(getVimState(), 'down', false)),
        vscode.commands.registerCommand('waltz.paragraphUpSelect', () => paragraphMove(getVimState(), 'up', true)),
        vscode.commands.registerCommand('waltz.paragraphDownSelect', () => paragraphMove(getVimState(), 'down', true)),
    );
}
