import * as vscode from 'vscode';
import { Position, Range, Selection } from 'vscode';
import { enterMode } from '../modes';
import type { VimState } from '../vimState';
import { findCharInLine, getCharViaQuickPick } from './find';

/**
 * Operator commands with args support
 * Called via keybindings like: { "command": "waltz.delete", "args": { "target": "iw" } }
 */

interface OperatorArgs {
    target?: string; // "iw", "aw", "w", "b", "$", "f", "t", etc. - all are text objects
    line?: boolean; // true for dd, cc, yy
}

/**
 * Get range for f/t/F/T text object with a specific character
 * VS Code philosophy: f=t (forward to left of char), F=T (backward to right of char)
 */
function getFindCharRange(
    document: vscode.TextDocument,
    position: Position,
    textObject: string,
    char: string,
): Range | null {
    const direction = textObject === 'f' || textObject === 't' ? 'forward' : 'backward';

    const targetPos = findCharInLine(document, position, char, direction);
    if (!targetPos) return null;

    // For operators, we want the range from cursor to target
    // forward: cursor to left side of char
    // backward: right side of char to cursor
    if (direction === 'forward') {
        return new Range(position, targetPos);
    } else {
        return new Range(targetPos, position);
    }
}

/**
 * Check if a text object requires character input (f/t/F/T)
 */
function isFindCharTextObject(textObject: string): boolean {
    return textObject === 'f' || textObject === 't' || textObject === 'F' || textObject === 'T';
}

/**
 * Get ranges for all selections based on a text object target
 * Handles f/t/F/T specially by prompting for character once
 */
async function getRangesForTarget(editor: vscode.TextEditor, target: string): Promise<Range[] | null> {
    const document = editor.document;
    const ranges: Range[] = [];

    // For f/t/F/T, get the character once before processing selections
    let findChar: string | null = null;
    if (isFindCharTextObject(target)) {
        const direction = target === 'f' || target === 't' ? 'forward' : 'backward';
        findChar = await getCharViaQuickPick(`Type a character to find ${direction}...`);
        if (!findChar) return null; // User cancelled
    }

    for (const selection of editor.selections) {
        const range = findChar
            ? getFindCharRange(document, selection.active, target, findChar)
            : getTextObjectRange(document, selection.active, target);
        if (range) ranges.push(range);
    }

    return ranges;
}

/**
 * Get range for a text object
 * This handles both traditional text objects (iw, aw, i(, etc.)
 * and what was previously called "motions" (w, b, $, etc.)
 */
export function getTextObjectRange(
    document: vscode.TextDocument,
    position: Position,
    textObject: string,
): Range | null {
    // Traditional text objects start with 'i' or 'a' followed by another character
    if (textObject.length >= 2 && (textObject.startsWith('i') || textObject.startsWith('a'))) {
        const inner = textObject.startsWith('i');
        const type = textObject.slice(1);

        switch (type) {
            case 'w': {
                const wordRange = document.getWordRangeAtPosition(position);
                if (wordRange) {
                    if (inner) {
                        return wordRange;
                    }
                    // "around" includes trailing whitespace
                    const line = document.lineAt(position.line).text;
                    let end = wordRange.end.character;
                    while (end < line.length && /\s/.test(line[end])) {
                        end++;
                    }
                    return new Range(wordRange.start, new Position(position.line, end));
                }
                return null;
            }
            case 'W': {
                // WORD: whitespace-delimited (any non-whitespace sequence)
                const line = document.lineAt(position.line).text;
                const col = position.character;
                // Find start of WORD
                let start = col;
                while (start > 0 && !/\s/.test(line[start - 1])) {
                    start--;
                }
                // Find end of WORD
                let end = col;
                while (end < line.length && !/\s/.test(line[end])) {
                    end++;
                }
                if (start === end) return null;
                if (!inner) {
                    // "around" includes trailing whitespace
                    while (end < line.length && /\s/.test(line[end])) {
                        end++;
                    }
                }
                return new Range(new Position(position.line, start), new Position(position.line, end));
            }
            case '(':
            case ')':
            case 'b': {
                return findPairRange(document, position, '(', ')', inner);
            }
            case '{':
            case '}':
            case 'B': {
                return findPairRange(document, position, '{', '}', inner);
            }
            case '[':
            case ']': {
                return findPairRange(document, position, '[', ']', inner);
            }
            case '<':
            case '>': {
                return findPairRange(document, position, '<', '>', inner);
            }
            case "'":
            case '"':
            case '`': {
                return findQuoteRange(document, position, type, inner);
            }
            default:
                return null;
        }
    }

    // Single-character or multi-character text objects (formerly "motions")
    switch (textObject) {
        case 'w': {
            const wordRange = document.getWordRangeAtPosition(position);
            if (wordRange) {
                return new Range(position, wordRange.end);
            }
            return new Range(position, position.translate(0, 1));
        }
        case 'W': {
            // WORD: cursor to end of WORD (whitespace-delimited)
            const line = document.lineAt(position.line).text;
            const col = position.character;
            let end = col;
            while (end < line.length && !/\s/.test(line[end])) {
                end++;
            }
            if (end === col) {
                return new Range(position, position.translate(0, 1));
            }
            return new Range(position, new Position(position.line, end));
        }
        case 'e': {
            const wordRange = document.getWordRangeAtPosition(position);
            if (wordRange) {
                return new Range(position, wordRange.end);
            }
            return new Range(position, position.translate(0, 1));
        }
        case 'E': {
            // WORD end: cursor to end of WORD (whitespace-delimited)
            const line = document.lineAt(position.line).text;
            const col = position.character;
            let end = col;
            while (end < line.length && !/\s/.test(line[end])) {
                end++;
            }
            if (end === col) {
                return new Range(position, position.translate(0, 1));
            }
            return new Range(position, new Position(position.line, end));
        }
        case 'b': {
            const wordRange = document.getWordRangeAtPosition(position);
            if (wordRange) {
                return new Range(wordRange.start, position);
            }
            return new Range(position.translate(0, -1), position);
        }
        case 'B': {
            // WORD backward: start of WORD to cursor (whitespace-delimited)
            const line = document.lineAt(position.line).text;
            const col = position.character;
            let start = col;
            while (start > 0 && !/\s/.test(line[start - 1])) {
                start--;
            }
            if (start === col) {
                return new Range(position.translate(0, -1), position);
            }
            return new Range(new Position(position.line, start), position);
        }
        case '$': {
            const lineEnd = document.lineAt(position.line).range.end;
            return new Range(position, lineEnd);
        }
        case '0': {
            const lineStart = new Position(position.line, 0);
            return new Range(lineStart, position);
        }
        case '^': {
            const line = document.lineAt(position.line);
            const firstNonWhitespace = line.firstNonWhitespaceCharacterIndex;
            return new Range(new Position(position.line, firstNonWhitespace), position);
        }
        case 'j': {
            const startLine = position.line;
            const endLine = Math.min(startLine + 1, document.lineCount - 1);
            return new Range(new Position(startLine, 0), document.lineAt(endLine).rangeIncludingLineBreak.end);
        }
        case 'k': {
            const startLine = Math.max(position.line - 1, 0);
            const endLine = position.line;
            return new Range(new Position(startLine, 0), document.lineAt(endLine).rangeIncludingLineBreak.end);
        }
        case 'h': {
            if (position.character > 0) {
                return new Range(position.translate(0, -1), position);
            }
            return null;
        }
        case 'l': {
            const lineLength = document.lineAt(position.line).text.length;
            if (position.character < lineLength) {
                return new Range(position, position.translate(0, 1));
            }
            return null;
        }
        case 'G': {
            return new Range(
                new Position(position.line, 0),
                document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end,
            );
        }
        case 'gg': {
            return new Range(new Position(0, 0), document.lineAt(position.line).rangeIncludingLineBreak.end);
        }
        default:
            return null;
    }
}

/**
 * Find matching pair range (parentheses, braces, brackets)
 */
export function findPairRange(
    document: vscode.TextDocument,
    position: Position,
    open: string,
    close: string,
    inner: boolean,
): Range | null {
    const text = document.getText();
    const offset = document.offsetAt(position);

    // Search backward for opening
    let depth = 0;
    let openPos = -1;
    for (let i = offset; i >= 0; i--) {
        if (text[i] === close) depth++;
        if (text[i] === open) {
            if (depth === 0) {
                openPos = i;
                break;
            }
            depth--;
        }
    }

    if (openPos === -1) return null;

    // Search forward for closing
    depth = 0;
    let closePos = -1;
    for (let i = openPos; i < text.length; i++) {
        if (text[i] === open) depth++;
        if (text[i] === close) {
            depth--;
            if (depth === 0) {
                closePos = i;
                break;
            }
        }
    }

    if (closePos === -1) return null;

    const start = document.positionAt(inner ? openPos + 1 : openPos);
    const end = document.positionAt(inner ? closePos : closePos + 1);
    return new Range(start, end);
}

/**
 * Find quote range
 */
export function findQuoteRange(
    document: vscode.TextDocument,
    position: Position,
    quote: string,
    inner: boolean,
): Range | null {
    const line = document.lineAt(position.line).text;
    const col = position.character;

    // Find opening quote (search backward)
    let openPos = -1;
    for (let i = col; i >= 0; i--) {
        if (line[i] === quote) {
            openPos = i;
            break;
        }
    }

    // If not found backward, check if we're at or before a quote
    if (openPos === -1) {
        for (let i = col; i < line.length; i++) {
            if (line[i] === quote) {
                openPos = i;
                break;
            }
        }
    }

    if (openPos === -1) return null;

    // Find closing quote
    let closePos = -1;
    for (let i = openPos + 1; i < line.length; i++) {
        if (line[i] === quote) {
            closePos = i;
            break;
        }
    }

    if (closePos === -1) return null;

    const start = new Position(position.line, inner ? openPos + 1 : openPos);
    const end = new Position(position.line, inner ? closePos : closePos + 1);
    return new Range(start, end);
}

/**
 * Execute delete operation
 */
async function executeDelete(editor: vscode.TextEditor, args: OperatorArgs): Promise<void> {
    const document = editor.document;
    let ranges: Range[] = [];

    if (args.line) {
        for (const selection of editor.selections) {
            const line = document.lineAt(selection.active.line);
            ranges.push(line.rangeIncludingLineBreak);
        }
    } else if (args.target) {
        const result = await getRangesForTarget(editor, args.target);
        if (!result) return; // User cancelled
        ranges = result;
    }

    if (ranges.length === 0) return;

    // Copy to clipboard
    const text = ranges.map((r) => document.getText(r)).join('\n');
    await vscode.env.clipboard.writeText(text);

    // Delete
    await editor.edit((editBuilder) => {
        for (const range of ranges) {
            editBuilder.delete(range);
        }
    });
}

/**
 * Execute change operation
 */
async function executeChange(editor: vscode.TextEditor, args: OperatorArgs, vimState: VimState): Promise<void> {
    const document = editor.document;
    let ranges: Range[] = [];

    if (args.line) {
        for (const selection of editor.selections) {
            const line = document.lineAt(selection.active.line);
            const firstNonWhitespace = line.firstNonWhitespaceCharacterIndex;
            ranges.push(new Range(new Position(selection.active.line, firstNonWhitespace), line.range.end));
        }
    } else if (args.target) {
        const result = await getRangesForTarget(editor, args.target);
        if (!result) return; // User cancelled
        ranges = result;
    }

    if (ranges.length === 0) return;

    // Copy to clipboard
    const text = ranges.map((r) => document.getText(r)).join('\n');
    await vscode.env.clipboard.writeText(text);

    // Delete and enter insert mode
    await editor.edit((editBuilder) => {
        for (const range of ranges) {
            editBuilder.delete(range);
        }
    });

    enterMode(vimState, editor, 'insert');
}

/**
 * Execute yank operation
 */
async function executeYank(editor: vscode.TextEditor, args: OperatorArgs): Promise<void> {
    const document = editor.document;
    let ranges: Range[] = [];

    if (args.line) {
        for (const selection of editor.selections) {
            const line = document.lineAt(selection.active.line);
            ranges.push(line.rangeIncludingLineBreak);
        }
    } else if (args.target) {
        const result = await getRangesForTarget(editor, args.target);
        if (!result) return; // User cancelled
        ranges = result;
    }

    if (ranges.length === 0) return;

    // Copy to clipboard
    const text = ranges.map((r) => document.getText(r)).join('\n');
    await vscode.env.clipboard.writeText(text);

    // Flash selection briefly to indicate yank
    const originalSelections = editor.selections;
    editor.selections = ranges.map((r) => new Selection(r.start, r.end));
    setTimeout(() => {
        editor.selections = originalSelections;
    }, 150);
}

/**
 * Execute select text object operation (for visual mode)
 */
async function executeSelectTextObject(editor: vscode.TextEditor, args: { target: string }): Promise<void> {
    const ranges = await getRangesForTarget(editor, args.target);
    if (!ranges) return; // User cancelled

    const newSelections: Selection[] = [];
    const selections = editor.selections;

    for (let i = 0; i < selections.length; i++) {
        const selection = selections[i];
        const range = ranges[i];
        if (range) {
            // Extend selection to include the text object range
            const newStart = selection.anchor.isBefore(range.start) ? selection.anchor : range.start;
            const newEnd = selection.anchor.isAfter(range.end) ? selection.anchor : range.end;

            // Determine anchor and active based on current selection direction
            if (selection.isReversed) {
                newSelections.push(new Selection(newEnd, newStart));
            } else {
                newSelections.push(new Selection(newStart, newEnd));
            }
        } else {
            newSelections.push(selection);
        }
    }

    if (newSelections.length > 0) {
        editor.selections = newSelections;
    }
}

export function registerOperatorCommands(context: vscode.ExtensionContext, getVimState: () => VimState): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.delete', (args: OperatorArgs) => {
            const editor = vscode.window.activeTextEditor;
            if (editor) executeDelete(editor, args || {});
        }),
        vscode.commands.registerCommand('waltz.change', (args: OperatorArgs) => {
            const editor = vscode.window.activeTextEditor;
            if (editor) executeChange(editor, args || {}, getVimState());
        }),
        vscode.commands.registerCommand('waltz.yank', (args: OperatorArgs) => {
            const editor = vscode.window.activeTextEditor;
            if (editor) executeYank(editor, args || {});
        }),
        vscode.commands.registerCommand('waltz.selectTextObject', (args: { target: string }) => {
            const editor = vscode.window.activeTextEditor;
            if (editor && args?.target) executeSelectTextObject(editor, args);
        }),
    );
}
