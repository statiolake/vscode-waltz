import * as vscode from 'vscode';
import { Position, Range, Selection } from 'vscode';
import { enterMode } from '../modes';
import type { VimState } from '../vimState';

/**
 * Operator commands with args support
 * Called via keybindings like:
 * { "command": "waltz.delete", "args": { "selectCommand": "cursorWordStartRightSelect" } }
 */

interface OperatorArgs {
    selectCommand?: string; // command to create selection, e.g. cursorWordStartRightSelect
    line?: boolean; // true for dd, cc, yy
}

type OperatorAction = 'delete' | 'change' | 'yank';

interface SelectionCommandSpec {
    command: string;
}

interface TextObjectSelectBinding {
    command: string;
    target: string;
}

function resolveSelectionCommandSpec(args: OperatorArgs): SelectionCommandSpec | null {
    if (args.selectCommand) {
        return {
            command: args.selectCommand,
        };
    }

    return null;
}

const TEXT_OBJECT_SELECT_BINDINGS: readonly TextObjectSelectBinding[] = [
    { command: 'waltz.innerWordSelect', target: 'iw' },
    { command: 'waltz.aroundWordSelect', target: 'aw' },
    { command: 'waltz.innerBigWordSelect', target: 'iW' },
    { command: 'waltz.aroundBigWordSelect', target: 'aW' },
    { command: 'waltz.innerParenSelect', target: 'i(' },
    { command: 'waltz.aroundParenSelect', target: 'a(' },
    { command: 'waltz.innerParenRightSelect', target: 'i)' },
    { command: 'waltz.aroundParenRightSelect', target: 'a)' },
    { command: 'waltz.innerBraceSelect', target: 'i{' },
    { command: 'waltz.aroundBraceSelect', target: 'a{' },
    { command: 'waltz.innerBraceRightSelect', target: 'i}' },
    { command: 'waltz.aroundBraceRightSelect', target: 'a}' },
    { command: 'waltz.innerBracketSelect', target: 'i[' },
    { command: 'waltz.aroundBracketSelect', target: 'a[' },
    { command: 'waltz.innerBracketRightSelect', target: 'i]' },
    { command: 'waltz.aroundBracketRightSelect', target: 'a]' },
    { command: 'waltz.innerAngleSelect', target: 'i<' },
    { command: 'waltz.aroundAngleSelect', target: 'a<' },
    { command: 'waltz.innerAngleRightSelect', target: 'i>' },
    { command: 'waltz.aroundAngleRightSelect', target: 'a>' },
    { command: 'waltz.innerSingleQuoteSelect', target: "i'" },
    { command: 'waltz.aroundSingleQuoteSelect', target: "a'" },
    { command: 'waltz.innerDoubleQuoteSelect', target: 'i"' },
    { command: 'waltz.aroundDoubleQuoteSelect', target: 'a"' },
    { command: 'waltz.innerBacktickSelect', target: 'i`' },
    { command: 'waltz.aroundBacktickSelect', target: 'a`' },
];

/**
 * Select range through command, then run copy/cut on that selection.
 * Selection is always reset before applying the selection command.
 */
async function executeOperatorWithSelectionCommand(
    editor: vscode.TextEditor,
    selectionSpec: SelectionCommandSpec,
    action: OperatorAction,
): Promise<boolean> {
    const originalSelections = editor.selections;

    try {
        // Start from a collapsed selection before applying selection command.
        await vscode.commands.executeCommand('cancelSelection');
        await vscode.commands.executeCommand(selectionSpec.command);
    } catch {
        return false;
    }

    if (editor.selections.every((selection) => selection.isEmpty)) {
        await vscode.commands.executeCommand('cancelSelection');
        return false;
    }

    if (action === 'yank') {
        await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
        editor.selections = originalSelections;
    } else {
        await vscode.commands.executeCommand('editor.action.clipboardCutAction');
    }

    return true;
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
    // Start from offset - 1 to avoid treating the closing char at cursor position as opening
    let depth = 0;
    let openPos = -1;
    for (let i = offset - 1; i >= 0; i--) {
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
    // Start from col - 1 to avoid treating the closing quote at cursor position as opening
    let openPos = -1;
    for (let i = col - 1; i >= 0; i--) {
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
    const ranges: Range[] = [];

    if (args.line) {
        for (const selection of editor.selections) {
            const line = document.lineAt(selection.active.line);
            ranges.push(line.rangeIncludingLineBreak);
        }
    } else {
        const selectionSpec = resolveSelectionCommandSpec(args);
        if (!selectionSpec) return;
        await executeOperatorWithSelectionCommand(editor, selectionSpec, 'delete');
        return;
    }

    if (ranges.length === 0) return;

    editor.selections = ranges.map((r) => new Selection(r.start, r.end));
    await vscode.commands.executeCommand('editor.action.clipboardCutAction');
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
    } else {
        const selectionSpec = resolveSelectionCommandSpec(args);
        if (!selectionSpec) return;
        const applied = await executeOperatorWithSelectionCommand(editor, selectionSpec, 'change');
        if (applied) {
            enterMode(vimState, editor, 'insert');
        }
        return;
    }

    if (ranges.length === 0) return;

    editor.selections = ranges.map((r) => new Selection(r.start, r.end));
    await vscode.commands.executeCommand('editor.action.clipboardCutAction');
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
    } else {
        const selectionSpec = resolveSelectionCommandSpec(args);
        if (!selectionSpec) return;
        await executeOperatorWithSelectionCommand(editor, selectionSpec, 'yank');
        return;
    }

    if (ranges.length === 0) return;

    // Copy to clipboard using VS Code's native copy command
    const originalSelections = editor.selections;
    editor.selections = ranges.map((r) => new Selection(r.start, r.end));
    await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
    editor.selections = originalSelections;
}

/**
 * Execute select text object operation (for visual mode)
 */
async function executeSelectTextObject(editor: vscode.TextEditor, target: string): Promise<void> {
    const ranges: Array<Range | null> = [];
    for (const selection of editor.selections) {
        const range = getTextObjectRange(editor.document, selection.active, target);
        ranges.push(range);
    }
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
    const textObjectSelectCommands = TEXT_OBJECT_SELECT_BINDINGS.map(({ command, target }) =>
        vscode.commands.registerCommand(command, () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) executeSelectTextObject(editor, target);
        }),
    );

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
        ...textObjectSelectCommands,
    );
}
