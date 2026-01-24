import * as vscode from 'vscode';
import { type Position, Selection } from 'vscode';

/**
 * WORD movement commands (whitespace-delimited words)
 * Following VS Code naming convention: cursorWhitespaceWord{Start,End}{Right,Left}{,Select}
 */

/**
 * Find the next WORD start (whitespace-delimited) forward
 */
function findNextWORDStart(document: vscode.TextDocument, position: Position): Position {
    const text = document.getText();
    let offset = document.offsetAt(position);
    const maxOffset = text.length;

    // Skip current non-whitespace
    while (offset < maxOffset && !/\s/.test(text[offset])) {
        offset++;
    }

    // Skip whitespace
    while (offset < maxOffset && /\s/.test(text[offset])) {
        offset++;
    }

    if (offset >= maxOffset) {
        return document.positionAt(maxOffset);
    }

    return document.positionAt(offset);
}

/**
 * Find the previous WORD start (whitespace-delimited) backward
 */
function findPrevWORDStart(document: vscode.TextDocument, position: Position): Position {
    const text = document.getText();
    let offset = document.offsetAt(position);

    if (offset === 0) return position;

    // Move back one to check previous character
    offset--;

    // Skip whitespace backward
    while (offset > 0 && /\s/.test(text[offset])) {
        offset--;
    }

    // Skip non-whitespace backward to find word start
    while (offset > 0 && !/\s/.test(text[offset - 1])) {
        offset--;
    }

    return document.positionAt(offset);
}

/**
 * Find the next WORD end (whitespace-delimited) forward
 */
function findNextWORDEnd(document: vscode.TextDocument, position: Position): Position {
    const text = document.getText();
    let offset = document.offsetAt(position);
    const maxOffset = text.length;

    if (offset >= maxOffset) return position;

    // Move forward one to start searching
    offset++;

    // Skip whitespace
    while (offset < maxOffset && /\s/.test(text[offset])) {
        offset++;
    }

    // Move through non-whitespace to find end
    while (offset < maxOffset && !/\s/.test(text[offset])) {
        offset++;
    }

    // Back up one to land on the last character of the word
    if (offset > 0) {
        offset--;
    }

    return document.positionAt(offset);
}

/**
 * Find the previous WORD end (whitespace-delimited) backward
 */
function findPrevWORDEnd(document: vscode.TextDocument, position: Position): Position {
    const text = document.getText();
    let offset = document.offsetAt(position);

    if (offset === 0) return position;

    // Move back one to check previous character
    offset--;

    // Skip non-whitespace backward (we might be at end of a word)
    while (offset > 0 && !/\s/.test(text[offset])) {
        offset--;
    }

    // Skip whitespace backward
    while (offset > 0 && /\s/.test(text[offset])) {
        offset--;
    }

    return document.positionAt(offset);
}

/**
 * Generic movement executor
 */
function executeMovement(
    findPosition: (document: vscode.TextDocument, position: Position) => Position,
    select: boolean,
): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    editor.selections = editor.selections.map((selection) => {
        const newPos = findPosition(editor.document, selection.active);
        if (select) {
            return new Selection(selection.anchor, newPos);
        }
        return new Selection(newPos, newPos);
    });

    editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

export function registerMotionCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        // W - cursorWhitespaceWordStartRight
        vscode.commands.registerCommand('waltz.cursorWhitespaceWordStartRight', () => {
            executeMovement(findNextWORDStart, false);
        }),
        vscode.commands.registerCommand('waltz.cursorWhitespaceWordStartRightSelect', () => {
            executeMovement(findNextWORDStart, true);
        }),

        // B - cursorWhitespaceWordStartLeft
        vscode.commands.registerCommand('waltz.cursorWhitespaceWordStartLeft', () => {
            executeMovement(findPrevWORDStart, false);
        }),
        vscode.commands.registerCommand('waltz.cursorWhitespaceWordStartLeftSelect', () => {
            executeMovement(findPrevWORDStart, true);
        }),

        // E - cursorWhitespaceWordEndRight
        vscode.commands.registerCommand('waltz.cursorWhitespaceWordEndRight', () => {
            executeMovement(findNextWORDEnd, false);
        }),
        vscode.commands.registerCommand('waltz.cursorWhitespaceWordEndRightSelect', () => {
            executeMovement(findNextWORDEnd, true);
        }),

        // gE - cursorWhitespaceWordEndLeft
        vscode.commands.registerCommand('waltz.cursorWhitespaceWordEndLeft', () => {
            executeMovement(findPrevWORDEnd, false);
        }),
        vscode.commands.registerCommand('waltz.cursorWhitespaceWordEndLeftSelect', () => {
            executeMovement(findPrevWORDEnd, true);
        }),
    );
}
