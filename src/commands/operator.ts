import * as vscode from 'vscode';
import { Position, Range } from 'vscode';
import { enterMode } from '../modes';
import type { VimState } from '../vimState';

/**
 * d/c/y オペレータ
 * QuickPick でモーション/TextObject 入力を待ち、即時発火
 */
const motionItems = [
    { label: 'w', description: 'Word (start)' },
    { label: 'b', description: 'Word backward' },
    { label: 'e', description: 'Word end' },
    { label: '$', description: 'End of line' },
    { label: '0', description: 'Start of line' },
    { label: '^', description: 'First non-blank' },
    { label: '{', description: 'Paragraph backward' },
    { label: '}', description: 'Paragraph forward' },
    { label: 'gg', description: 'Document start' },
    { label: 'G', description: 'Document end' },
    { label: 'iw', description: 'Inner word' },
    { label: 'aw', description: 'Around word' },
    { label: 'i(', description: 'Inner parentheses' },
    { label: 'a(', description: 'Around parentheses' },
    { label: 'i{', description: 'Inner braces' },
    { label: 'a{', description: 'Around braces' },
    { label: 'i[', description: 'Inner brackets' },
    { label: 'a[', description: 'Around brackets' },
    { label: 'i<', description: 'Inner angle brackets' },
    { label: 'a<', description: 'Around angle brackets' },
    { label: "i'", description: 'Inner single quotes' },
    { label: "a'", description: 'Around single quotes' },
    { label: 'i"', description: 'Inner double quotes' },
    { label: 'a"', description: 'Around double quotes' },
    { label: 'i`', description: 'Inner backticks' },
    { label: 'a`', description: 'Around backticks' },
];

// Single-character inputs that should immediately fire
const immediateMatches = new Set([
    'w',
    'W',
    'b',
    'B',
    'e',
    'E',
    '$',
    '0',
    '^',
    '{',
    '}',
    'G',
    'j',
    'k',
    'h',
    'l',
    '%',
]);

// Two-character inputs that should immediately fire
const twoCharMatches = new Set([
    'iw',
    'aw',
    'iW',
    'aW',
    'i(',
    'a(',
    'i)',
    'a)',
    'ib',
    'ab',
    'i{',
    'a{',
    'i}',
    'a}',
    'iB',
    'aB',
    'i[',
    'a[',
    'i]',
    'a]',
    'i<',
    'a<',
    'i>',
    'a>',
    "i'",
    "a'",
    'i"',
    'a"',
    'i`',
    'a`',
    'it',
    'at',
    'gg',
    'ge',
    'gE',
]);

function shouldFireImmediately(input: string, operatorKey: string): boolean {
    // dd, cc, yy - line operation
    if (input === operatorKey) return true;

    // Single-char motions
    if (input.length === 1 && immediateMatches.has(input)) return true;

    // Two-char text objects and motions
    if (input.length === 2 && twoCharMatches.has(input)) return true;

    // f/t/F/T with character
    if (input.length === 2 && ['f', 't', 'F', 'T'].includes(input[0])) return true;

    return false;
}

/**
 * Calculate range for a motion
 */
function getMotionRange(
    editor: vscode.TextEditor,
    motion: string,
    position: Position,
): Range | null {
    const document = editor.document;

    switch (motion) {
        case 'w':
        case 'W': {
            // Word motion: from current position to start of next word
            const wordRange = document.getWordRangeAtPosition(position);
            if (wordRange) {
                return new Range(position, wordRange.end);
            }
            return new Range(position, position.translate(0, 1));
        }
        case 'e':
        case 'E': {
            // Word end motion
            const wordRange = document.getWordRangeAtPosition(position);
            if (wordRange) {
                return new Range(position, wordRange.end);
            }
            return new Range(position, position.translate(0, 1));
        }
        case 'b':
        case 'B': {
            // Word backward motion
            const wordRange = document.getWordRangeAtPosition(position);
            if (wordRange) {
                return new Range(wordRange.start, position);
            }
            return new Range(position.translate(0, -1), position);
        }
        case '$': {
            // End of line
            const lineEnd = document.lineAt(position.line).range.end;
            return new Range(position, lineEnd);
        }
        case '0':
        case '^': {
            // Start of line
            const lineStart = new Position(position.line, 0);
            return new Range(lineStart, position);
        }
        case 'j': {
            // Down one line (linewise)
            const startLine = position.line;
            const endLine = Math.min(startLine + 1, document.lineCount - 1);
            return new Range(
                new Position(startLine, 0),
                document.lineAt(endLine).rangeIncludingLineBreak.end,
            );
        }
        case 'k': {
            // Up one line (linewise)
            const startLine = Math.max(position.line - 1, 0);
            const endLine = position.line;
            return new Range(
                new Position(startLine, 0),
                document.lineAt(endLine).rangeIncludingLineBreak.end,
            );
        }
        case 'h': {
            // Left one character
            if (position.character > 0) {
                return new Range(position.translate(0, -1), position);
            }
            return null;
        }
        case 'l': {
            // Right one character
            const lineLength = document.lineAt(position.line).text.length;
            if (position.character < lineLength) {
                return new Range(position, position.translate(0, 1));
            }
            return null;
        }
        case 'G': {
            // To end of document (linewise)
            return new Range(
                new Position(position.line, 0),
                document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end,
            );
        }
        case 'gg': {
            // To start of document (linewise)
            return new Range(
                new Position(0, 0),
                document.lineAt(position.line).rangeIncludingLineBreak.end,
            );
        }
        case 'iw':
        case 'aw': {
            // Inner/around word
            const wordRange = document.getWordRangeAtPosition(position);
            if (wordRange) {
                return motion === 'aw'
                    ? new Range(wordRange.start, wordRange.end.translate(0, 1))
                    : wordRange;
            }
            return null;
        }
        default:
            return null;
    }
}

/**
 * Delete entire line (dd)
 */
async function deleteLine(editor: vscode.TextEditor): Promise<void> {
    await editor.edit((editBuilder) => {
        for (const selection of editor.selections) {
            const line = editor.document.lineAt(selection.active.line);
            editBuilder.delete(line.rangeIncludingLineBreak);
        }
    });
}

/**
 * Yank entire line (yy)
 */
async function yankLine(editor: vscode.TextEditor): Promise<void> {
    const lines = editor.selections.map((selection) => {
        const line = editor.document.lineAt(selection.active.line);
        return editor.document.getText(line.rangeIncludingLineBreak);
    });
    await vscode.env.clipboard.writeText(lines.join(''));
}

/**
 * Change entire line (cc)
 */
async function changeLine(editor: vscode.TextEditor, vimState: VimState): Promise<void> {
    // Delete line content but keep indentation
    await editor.edit((editBuilder) => {
        for (const selection of editor.selections) {
            const line = editor.document.lineAt(selection.active.line);
            const firstNonWhitespace = line.firstNonWhitespaceCharacterIndex;
            const deleteRange = new Range(
                new Position(selection.active.line, firstNonWhitespace),
                line.range.end,
            );
            editBuilder.delete(deleteRange);
        }
    });
    enterMode(vimState, editor, 'insert');
}

async function operatorCommand(
    operatorKey: string,
    operatorName: string,
    getVimState: () => VimState,
): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const quickPick = vscode.window.createQuickPick();
    quickPick.items = [{ label: operatorKey, description: `${operatorName} line` }, ...motionItems];
    quickPick.placeholder = `${operatorName}: Type motion/text object (${operatorKey} for line, w for word, iw for inner word, ...)`;

    let input = '';
    const result = await new Promise<string>((resolve) => {
        quickPick.onDidChangeValue((value) => {
            input = value;
            // Check if we should fire immediately
            if (shouldFireImmediately(value, operatorKey)) {
                quickPick.hide();
                resolve(value);
            }
        });

        quickPick.onDidAccept(() => {
            const selected = quickPick.selectedItems[0];
            quickPick.hide();
            resolve(selected?.label ?? input);
        });

        quickPick.onDidHide(() => {
            resolve('');
            quickPick.dispose();
        });

        quickPick.show();
    });

    if (!result) return;

    const vimState = getVimState();

    // Handle line operations (dd, yy, cc)
    if (result === operatorKey) {
        switch (operatorKey) {
            case 'd':
                await deleteLine(editor);
                break;
            case 'y':
                await yankLine(editor);
                break;
            case 'c':
                await changeLine(editor, vimState);
                break;
        }
        return;
    }

    // Handle motion-based operations
    const ranges: Range[] = [];
    for (const selection of editor.selections) {
        const range = getMotionRange(editor, result, selection.active);
        if (range) {
            ranges.push(range);
        }
    }

    if (ranges.length === 0) return;

    // Copy text to clipboard
    const text = ranges.map((range) => editor.document.getText(range)).join('\n');
    await vscode.env.clipboard.writeText(text);

    // Execute operation
    switch (operatorKey) {
        case 'd':
        case 'c':
            await editor.edit((editBuilder) => {
                for (const range of ranges) {
                    editBuilder.delete(range);
                }
            });
            if (operatorKey === 'c') {
                enterMode(vimState, editor, 'insert');
            }
            break;
        case 'y':
            // Just yank, don't delete
            break;
    }
}

export function registerOperatorCommands(
    context: vscode.ExtensionContext,
    getVimState: () => VimState,
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.deleteOperator', () =>
            operatorCommand('d', 'Delete', getVimState),
        ),
        vscode.commands.registerCommand('waltz.changeOperator', () =>
            operatorCommand('c', 'Change', getVimState),
        ),
        vscode.commands.registerCommand('waltz.yankOperator', () =>
            operatorCommand('y', 'Yank', getVimState),
        ),
    );
}
