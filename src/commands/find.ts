import * as vscode from 'vscode';
import { Position, Selection } from 'vscode';
import type { VimState } from '../vimState';

/**
 * 文字を検索してカーソルを移動する
 */
export function findCharInLine(
    document: vscode.TextDocument,
    position: Position,
    char: string,
    direction: 'forward' | 'backward',
    stopBefore: boolean,
): Position | null {
    const line = document.lineAt(position.line);
    const lineText = line.text;

    if (direction === 'forward') {
        for (let i = position.character + 1; i < lineText.length; i++) {
            if (lineText[i] === char) {
                return new Position(position.line, stopBefore ? i - 1 : i);
            }
        }
    } else {
        for (let i = position.character - 1; i >= 0; i--) {
            if (lineText[i] === char) {
                return new Position(position.line, stopBefore ? i + 1 : i);
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
 */
async function findCharCommand(
    vimState: VimState,
    direction: 'forward' | 'backward',
    stopBefore: boolean,
): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const char = await getCharViaQuickPick(`Type a character to find ${direction}${stopBefore ? ' (before)' : ''}...`);
    if (!char) return;

    // Record last f/t for ; and , repeat
    vimState.lastFt = {
        character: char,
        distance: stopBefore ? 'nearer' : 'further',
        direction: direction === 'forward' ? 'after' : 'before',
    };

    // Execute find
    executeFindChar(editor, vimState, char, direction, stopBefore);
}

function executeFindChar(
    editor: vscode.TextEditor,
    vimState: VimState,
    char: string,
    direction: 'forward' | 'backward',
    stopBefore: boolean,
): void {
    const isVisual = vimState.mode === 'visual';

    editor.selections = editor.selections.map((selection) => {
        const newPos = findCharInLine(editor.document, selection.active, char, direction, stopBefore);
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

    const { character, distance, direction } = vimState.lastFt;
    const actualDirection = reverse ? (direction === 'after' ? 'before' : 'after') : direction;
    const stopBefore = distance === 'nearer';

    executeFindChar(editor, vimState, character, actualDirection === 'after' ? 'forward' : 'backward', stopBefore);
}

export function registerFindCommands(context: vscode.ExtensionContext, getVimState: () => VimState): void {
    context.subscriptions.push(
        // f and t both move to the character (same behavior in waltz)
        vscode.commands.registerCommand('waltz.findCharForward', () =>
            findCharCommand(getVimState(), 'forward', false),
        ),
        vscode.commands.registerCommand('waltz.findCharForwardBefore', () =>
            findCharCommand(getVimState(), 'forward', false),
        ),
        // F and T both move to the character backward (same behavior in waltz)
        vscode.commands.registerCommand('waltz.findCharBackward', () =>
            findCharCommand(getVimState(), 'backward', false),
        ),
        vscode.commands.registerCommand('waltz.findCharBackwardBefore', () =>
            findCharCommand(getVimState(), 'backward', false),
        ),
        vscode.commands.registerCommand('waltz.repeatFindChar', () => repeatFindChar(getVimState(), false)),
        vscode.commands.registerCommand('waltz.repeatFindCharReverse', () => repeatFindChar(getVimState(), true)),
    );
}
