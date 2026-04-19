import * as vscode from 'vscode';
import { type Position, Selection } from 'vscode';

/**
 * WORD movement commands (whitespace-delimited words)
 * Following VS Code naming convention: cursorWhitespaceWord{Start,End}{Right,Left}{,Select}
 *
 * I-beam cursor model: Position is BETWEEN characters, not ON characters.
 * For text "foo bar":
 *   Position 0 = before 'f'
 *   Position 3 = after 'o', before ' '
 *   Position 7 = after 'r' (end of text)
 *
 * "Word start" = position before first character of word
 * "Word end" = position after last character of word
 */

/**
 * Find position before next WORD (whitespace-delimited) - implements W motion
 *
 * From any position, moves to position before the first character of the next WORD.
 * Skips past current WORD (if in one), then skips whitespace.
 */
function findNextWORDStart(document: vscode.TextDocument, position: Position): Position {
    const text = document.getText();
    let offset = document.offsetAt(position);
    const maxOffset = text.length;

    // Skip past current WORD (non-whitespace characters after cursor)
    while (offset < maxOffset && !/\s/.test(text[offset])) {
        offset++;
    }

    // Skip whitespace to reach position before next WORD
    while (offset < maxOffset && /\s/.test(text[offset])) {
        offset++;
    }

    return document.positionAt(offset);
}

/**
 * Find position before previous WORD (whitespace-delimited) - implements B motion
 *
 * From any position, moves to position before the first character of the previous WORD.
 */
function findPrevWORDStart(document: vscode.TextDocument, position: Position): Position {
    const text = document.getText();
    let offset = document.offsetAt(position);

    if (offset === 0) return position;

    // Look at character before cursor position
    offset--;

    // Skip whitespace backward
    while (offset > 0 && /\s/.test(text[offset])) {
        offset--;
    }

    // Skip non-whitespace backward to find position before WORD start
    while (offset > 0 && !/\s/.test(text[offset - 1])) {
        offset--;
    }

    return document.positionAt(offset);
}

/**
 * Find position after current/next WORD end (whitespace-delimited) - implements E motion
 *
 * From any position, moves to position after the last character of current WORD,
 * or if at whitespace/end of WORD, moves to position after next WORD.
 */
function findNextWORDEnd(document: vscode.TextDocument, position: Position): Position {
    const text = document.getText();
    let offset = document.offsetAt(position);
    const maxOffset = text.length;

    if (offset >= maxOffset) return position;

    // Move one position forward to start searching (handles being at end of WORD)
    offset++;

    // Skip whitespace
    while (offset < maxOffset && /\s/.test(text[offset])) {
        offset++;
    }

    // Move through WORD characters to find position after last character
    while (offset < maxOffset && !/\s/.test(text[offset])) {
        offset++;
    }

    // offset is now at position after WORD (I-beam model: this is "word end")
    return document.positionAt(offset);
}

/**
 * Find position after previous WORD end (whitespace-delimited) - implements gE motion
 *
 * From any position, moves to position after the last character of the previous WORD.
 */
function findPrevWORDEnd(document: vscode.TextDocument, position: Position): Position {
    const text = document.getText();
    let offset = document.offsetAt(position);

    if (offset === 0) return position;

    // Look at character before cursor position
    offset--;

    // If we're in a WORD, skip to its beginning first
    while (offset > 0 && !/\s/.test(text[offset])) {
        offset--;
    }

    // Skip whitespace backward to find previous WORD
    while (offset > 0 && /\s/.test(text[offset])) {
        offset--;
    }

    // Now at last character of previous WORD, move to position after it
    // (I-beam model: position after last character = "word end")
    return document.positionAt(offset + 1);
}

/**
 * Execute movement command on all cursors
 * Handles multi-cursor by operating on editor.selections (plural)
 *
 * editor が取れないときは native の word motion (区切り基準が異なる) にフォールバック。
 * WORD (whitespace-delimited) と word (word-separator-delimited) は意味論的に違うが、
 * 巨大ファイルで shift+W が無反応になるよりは「進む」ほうがストレスが小さい。
 */
async function executeMovement(
    findPosition: (document: vscode.TextDocument, position: Position) => Position,
    select: boolean,
    fallbackCommand: string,
): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        await vscode.commands.executeCommand(fallbackCommand);
        return;
    }

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
        // W - move to position before next WORD
        vscode.commands.registerCommand('waltz.cursorWhitespaceWordStartRight', () =>
            executeMovement(findNextWORDStart, false, 'cursorWordStartRight'),
        ),
        vscode.commands.registerCommand('waltz.cursorWhitespaceWordStartRightSelect', () =>
            executeMovement(findNextWORDStart, true, 'cursorWordStartRightSelect'),
        ),

        // B - move to position before previous WORD
        vscode.commands.registerCommand('waltz.cursorWhitespaceWordStartLeft', () =>
            executeMovement(findPrevWORDStart, false, 'cursorWordStartLeft'),
        ),
        vscode.commands.registerCommand('waltz.cursorWhitespaceWordStartLeftSelect', () =>
            executeMovement(findPrevWORDStart, true, 'cursorWordStartLeftSelect'),
        ),

        // E - move to position after current/next WORD
        vscode.commands.registerCommand('waltz.cursorWhitespaceWordEndRight', () =>
            executeMovement(findNextWORDEnd, false, 'cursorWordEndRight'),
        ),
        vscode.commands.registerCommand('waltz.cursorWhitespaceWordEndRightSelect', () =>
            executeMovement(findNextWORDEnd, true, 'cursorWordEndRightSelect'),
        ),

        // gE - move to position after previous WORD
        vscode.commands.registerCommand('waltz.cursorWhitespaceWordEndLeft', () =>
            executeMovement(findPrevWORDEnd, false, 'cursorWordEndLeft'),
        ),
        vscode.commands.registerCommand('waltz.cursorWhitespaceWordEndLeftSelect', () =>
            executeMovement(findPrevWORDEnd, true, 'cursorWordEndLeftSelect'),
        ),
    );
}
