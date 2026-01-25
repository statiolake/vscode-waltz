import * as vscode from 'vscode';
import { Position, Range, Selection } from 'vscode';
import { enterMode } from '../modes';
import type { VimState } from '../vimState';

/**
 * Operator commands with args support
 * Called via keybindings like: { "command": "waltz.delete", "args": { "textObject": "iw" } }
 */

interface OperatorArgs {
    textObject?: string; // "iw", "aw", "i(", etc.
    motion?: string; // "w", "b", "$", etc.
    line?: boolean; // true for dd, cc, yy
}

/**
 * Get range for a text object
 */
export function getTextObjectRange(
    document: vscode.TextDocument,
    position: Position,
    textObject: string,
): Range | null {
    const inner = textObject.startsWith('i');
    const type = textObject.slice(1);

    switch (type) {
        case 'w':
        case 'W': {
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
 * Get range for a motion
 */
function getMotionRange(document: vscode.TextDocument, position: Position, motion: string): Range | null {
    switch (motion) {
        case 'w':
        case 'W': {
            const wordRange = document.getWordRangeAtPosition(position);
            if (wordRange) {
                return new Range(position, wordRange.end);
            }
            return new Range(position, position.translate(0, 1));
        }
        case 'e':
        case 'E': {
            const wordRange = document.getWordRangeAtPosition(position);
            if (wordRange) {
                return new Range(position, wordRange.end);
            }
            return new Range(position, position.translate(0, 1));
        }
        case 'b':
        case 'B': {
            const wordRange = document.getWordRangeAtPosition(position);
            if (wordRange) {
                return new Range(wordRange.start, position);
            }
            return new Range(position.translate(0, -1), position);
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
 * Execute delete operation
 */
async function executeDelete(editor: vscode.TextEditor, args: OperatorArgs): Promise<void> {
    const document = editor.document;
    const ranges: Range[] = [];

    if (args.line) {
        for (const selection of editor.selections) {
            const line = document.lineAt(selection.active.line);
            ranges.push(line.rangeIncludingLineBreak);
        }
    } else if (args.textObject) {
        for (const selection of editor.selections) {
            const range = getTextObjectRange(document, selection.active, args.textObject);
            if (range) ranges.push(range);
        }
    } else if (args.motion) {
        for (const selection of editor.selections) {
            const range = getMotionRange(document, selection.active, args.motion);
            if (range) ranges.push(range);
        }
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
    const ranges: Range[] = [];

    if (args.line) {
        for (const selection of editor.selections) {
            const line = document.lineAt(selection.active.line);
            const firstNonWhitespace = line.firstNonWhitespaceCharacterIndex;
            ranges.push(new Range(new Position(selection.active.line, firstNonWhitespace), line.range.end));
        }
    } else if (args.textObject) {
        for (const selection of editor.selections) {
            const range = getTextObjectRange(document, selection.active, args.textObject);
            if (range) ranges.push(range);
        }
    } else if (args.motion) {
        for (const selection of editor.selections) {
            const range = getMotionRange(document, selection.active, args.motion);
            if (range) ranges.push(range);
        }
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
    const ranges: Range[] = [];

    if (args.line) {
        for (const selection of editor.selections) {
            const line = document.lineAt(selection.active.line);
            ranges.push(line.rangeIncludingLineBreak);
        }
    } else if (args.textObject) {
        for (const selection of editor.selections) {
            const range = getTextObjectRange(document, selection.active, args.textObject);
            if (range) ranges.push(range);
        }
    } else if (args.motion) {
        for (const selection of editor.selections) {
            const range = getMotionRange(document, selection.active, args.motion);
            if (range) ranges.push(range);
        }
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
function executeSelectTextObject(editor: vscode.TextEditor, args: { textObject: string }): void {
    const document = editor.document;
    const newSelections: Selection[] = [];

    for (const selection of editor.selections) {
        const range = getTextObjectRange(document, selection.active, args.textObject);
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
        vscode.commands.registerCommand('waltz.selectTextObject', (args: { textObject: string }) => {
            const editor = vscode.window.activeTextEditor;
            if (editor && args?.textObject) executeSelectTextObject(editor, args);
        }),
    );
}
