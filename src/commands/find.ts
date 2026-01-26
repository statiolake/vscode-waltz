import * as vscode from 'vscode';
import { Position, Selection } from 'vscode';
import type { VimState } from '../vimState';

/**
 * Find character in line and return cursor position
 * VS Code philosophy:
 * - forward (f/t): returns position at left side of character
 * - backward (F/T): returns position at right side of character
 */
export function findCharInLine(
    document: vscode.TextDocument,
    position: Position,
    char: string,
    direction: 'forward' | 'backward',
): Position | null {
    const line = document.lineAt(position.line);
    const lineText = line.text;

    if (direction === 'forward') {
        for (let i = position.character + 1; i < lineText.length; i++) {
            if (lineText[i] === char) {
                // VS Code philosophy: f/t move to the left side of the character
                return new Position(position.line, i);
            }
        }
    } else {
        // Start from position.character - 2 to skip the character immediately left of cursor
        // This maintains symmetry with forward direction (which skips the character at cursor position)
        for (let i = position.character - 2; i >= 0; i--) {
            if (lineText[i] === char) {
                // VS Code philosophy: F/T move to the right side of the character
                return new Position(position.line, i + 1);
            }
        }
    }
    return null;
}

/**
 * Get a character via QuickPick
 */
export async function getCharViaQuickPick(prompt: string): Promise<string | null> {
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
 * f/t/F/T コマンド
 * QuickPick で文字入力を待ち、即時発火
 * VS Code philosophy: f=t (forward), F=T (backward)
 */
async function findCharCommand(vimState: VimState, direction: 'forward' | 'backward'): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const char = await getCharViaQuickPick(`Type a character to find ${direction}...`);
    if (!char) return;

    // Record last f/t for ; and , repeat
    vimState.lastFt = {
        character: char,
        distance: 'further', // Not used in VS Code philosophy, but kept for compatibility
        direction: direction === 'forward' ? 'after' : 'before',
    };

    // Execute find
    executeFindChar(editor, vimState, char, direction);
}

function executeFindChar(
    editor: vscode.TextEditor,
    vimState: VimState,
    char: string,
    direction: 'forward' | 'backward',
): void {
    const isVisual = vimState.mode === 'visual';

    editor.selections = editor.selections.map((selection) => {
        const newPos = findCharInLine(editor.document, selection.active, char, direction);
        if (newPos) {
            if (isVisual) {
                return new Selection(selection.anchor, newPos);
            }
            return new Selection(newPos, newPos);
        }
        return selection;
    });
}

function repeatFindChar(vimState: VimState, reverse: boolean): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !vimState.lastFt) return;

    const { character, direction } = vimState.lastFt;
    const actualDirection = reverse ? (direction === 'after' ? 'before' : 'after') : direction;

    executeFindChar(editor, vimState, character, actualDirection === 'after' ? 'forward' : 'backward');
}

export function registerFindCommands(context: vscode.ExtensionContext, getVimState: () => VimState): void {
    context.subscriptions.push(
        // f and t both move to the character (same behavior in waltz)
        vscode.commands.registerCommand('waltz.findCharForward', () => findCharCommand(getVimState(), 'forward')),
        vscode.commands.registerCommand('waltz.findCharForwardBefore', () => findCharCommand(getVimState(), 'forward')),
        // F and T both move to the character backward (same behavior in waltz)
        vscode.commands.registerCommand('waltz.findCharBackward', () => findCharCommand(getVimState(), 'backward')),
        vscode.commands.registerCommand('waltz.findCharBackwardBefore', () =>
            findCharCommand(getVimState(), 'backward'),
        ),
        vscode.commands.registerCommand('waltz.repeatFindChar', () => repeatFindChar(getVimState(), false)),
        vscode.commands.registerCommand('waltz.repeatFindCharReverse', () => repeatFindChar(getVimState(), true)),
    );
}
