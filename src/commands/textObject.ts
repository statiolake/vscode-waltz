import * as vscode from 'vscode';
import { Position, Range, Selection, type TextEditor } from 'vscode';

function applyTextObjectSelection(
    editor: TextEditor | undefined,
    resolveRange: (document: vscode.TextDocument, position: Position) => Range | null,
): void {
    if (!editor) return;

    const newSelections: Selection[] = editor.selections.map((selection) => {
        const range = resolveRange(editor.document, selection.active);
        if (!range) return selection;

        const newStart = selection.anchor.isBefore(range.start) ? selection.anchor : range.start;
        const newEnd = selection.anchor.isAfter(range.end) ? selection.anchor : range.end;

        return selection.isReversed ? new Selection(newEnd, newStart) : new Selection(newStart, newEnd);
    });

    editor.selections = newSelections;
}

function findWhitespaceWordBounds(line: string, col: number): { start: number; end: number } | null {
    let start = col;
    while (start > 0 && !/\s/.test(line[start - 1])) {
        start--;
    }

    let end = col;
    while (end < line.length && !/\s/.test(line[end])) {
        end++;
    }

    if (start === end) return null;
    return { start, end };
}

export function getInnerWordRange(document: vscode.TextDocument, position: Position): Range | null {
    return document.getWordRangeAtPosition(position) ?? null;
}

export function getAroundWordRange(document: vscode.TextDocument, position: Position): Range | null {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) return null;

    const line = document.lineAt(position.line).text;
    let end = wordRange.end.character;
    while (end < line.length && /\s/.test(line[end])) {
        end++;
    }

    return new Range(wordRange.start, new Position(position.line, end));
}

export function getInnerBigWordRange(document: vscode.TextDocument, position: Position): Range | null {
    const line = document.lineAt(position.line).text;
    const bounds = findWhitespaceWordBounds(line, position.character);
    if (!bounds) return null;

    return new Range(new Position(position.line, bounds.start), new Position(position.line, bounds.end));
}

export function getAroundBigWordRange(document: vscode.TextDocument, position: Position): Range | null {
    const line = document.lineAt(position.line).text;
    const bounds = findWhitespaceWordBounds(line, position.character);
    if (!bounds) return null;

    let end = bounds.end;
    while (end < line.length && /\s/.test(line[end])) {
        end++;
    }

    return new Range(new Position(position.line, bounds.start), new Position(position.line, end));
}

export function findPairRange(
    document: vscode.TextDocument,
    position: Position,
    open: string,
    close: string,
    inner: boolean,
): Range | null {
    const text = document.getText();
    const offset = document.offsetAt(position);

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

export function findQuoteRange(
    document: vscode.TextDocument,
    position: Position,
    quote: string,
    inner: boolean,
): Range | null {
    const line = document.lineAt(position.line).text;
    const col = position.character;

    let openPos = -1;
    for (let i = col - 1; i >= 0; i--) {
        if (line[i] === quote) {
            openPos = i;
            break;
        }
    }

    if (openPos === -1) {
        for (let i = col; i < line.length; i++) {
            if (line[i] === quote) {
                openPos = i;
                break;
            }
        }
    }

    if (openPos === -1) return null;

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

export function getInnerParenRange(document: vscode.TextDocument, position: Position): Range | null {
    return findPairRange(document, position, '(', ')', true);
}

export function getAroundParenRange(document: vscode.TextDocument, position: Position): Range | null {
    return findPairRange(document, position, '(', ')', false);
}

export function getInnerBraceRange(document: vscode.TextDocument, position: Position): Range | null {
    return findPairRange(document, position, '{', '}', true);
}

export function getAroundBraceRange(document: vscode.TextDocument, position: Position): Range | null {
    return findPairRange(document, position, '{', '}', false);
}

export function getInnerBracketRange(document: vscode.TextDocument, position: Position): Range | null {
    return findPairRange(document, position, '[', ']', true);
}

export function getAroundBracketRange(document: vscode.TextDocument, position: Position): Range | null {
    return findPairRange(document, position, '[', ']', false);
}

export function getInnerAngleRange(document: vscode.TextDocument, position: Position): Range | null {
    return findPairRange(document, position, '<', '>', true);
}

export function getAroundAngleRange(document: vscode.TextDocument, position: Position): Range | null {
    return findPairRange(document, position, '<', '>', false);
}

export function getInnerSingleQuoteRange(document: vscode.TextDocument, position: Position): Range | null {
    return findQuoteRange(document, position, "'", true);
}

export function getAroundSingleQuoteRange(document: vscode.TextDocument, position: Position): Range | null {
    return findQuoteRange(document, position, "'", false);
}

export function getInnerDoubleQuoteRange(document: vscode.TextDocument, position: Position): Range | null {
    return findQuoteRange(document, position, '"', true);
}

export function getAroundDoubleQuoteRange(document: vscode.TextDocument, position: Position): Range | null {
    return findQuoteRange(document, position, '"', false);
}

export function getInnerBacktickRange(document: vscode.TextDocument, position: Position): Range | null {
    return findQuoteRange(document, position, '`', true);
}

export function getAroundBacktickRange(document: vscode.TextDocument, position: Position): Range | null {
    return findQuoteRange(document, position, '`', false);
}

export function getWordForwardRange(document: vscode.TextDocument, position: Position): Range | null {
    const wordRange = document.getWordRangeAtPosition(position);
    if (wordRange) {
        return new Range(position, wordRange.end);
    }
    return new Range(position, position.translate(0, 1));
}

export function getWordBackwardRange(document: vscode.TextDocument, position: Position): Range | null {
    const wordRange = document.getWordRangeAtPosition(position);
    if (wordRange) {
        return new Range(wordRange.start, position);
    }
    return new Range(position.translate(0, -1), position);
}

export function getWordEndRange(document: vscode.TextDocument, position: Position): Range | null {
    const wordRange = document.getWordRangeAtPosition(position);
    if (wordRange) {
        return new Range(position, wordRange.end);
    }
    return new Range(position, position.translate(0, 1));
}

export function getLineEndRange(document: vscode.TextDocument, position: Position): Range | null {
    return new Range(position, document.lineAt(position.line).range.end);
}

export function getLineStartRange(_document: vscode.TextDocument, position: Position): Range | null {
    return new Range(new Position(position.line, 0), position);
}

export function getLineFirstNonWhitespaceRange(document: vscode.TextDocument, position: Position): Range | null {
    const line = document.lineAt(position.line);
    return new Range(new Position(position.line, line.firstNonWhitespaceCharacterIndex), position);
}

export function getCharLeftRange(_document: vscode.TextDocument, position: Position): Range | null {
    if (position.character > 0) {
        return new Range(position.translate(0, -1), position);
    }
    return null;
}

export function getCharRightRange(document: vscode.TextDocument, position: Position): Range | null {
    const lineLength = document.lineAt(position.line).text.length;
    if (position.character < lineLength) {
        return new Range(position, position.translate(0, 1));
    }
    return null;
}

export function getLineDownRange(document: vscode.TextDocument, position: Position): Range | null {
    const startLine = position.line;
    const endLine = Math.min(startLine + 1, document.lineCount - 1);
    return new Range(new Position(startLine, 0), document.lineAt(endLine).rangeIncludingLineBreak.end);
}

export function getLineUpRange(document: vscode.TextDocument, position: Position): Range | null {
    const startLine = Math.max(position.line - 1, 0);
    const endLine = position.line;
    return new Range(new Position(startLine, 0), document.lineAt(endLine).rangeIncludingLineBreak.end);
}

export function selectInnerWord(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getInnerWordRange);
}

export function selectAroundWord(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getAroundWordRange);
}

export function selectInnerBigWord(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getInnerBigWordRange);
}

export function selectAroundBigWord(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getAroundBigWordRange);
}

export function selectInnerParen(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getInnerParenRange);
}

export function selectAroundParen(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getAroundParenRange);
}

export function selectInnerParenRight(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getInnerParenRange);
}

export function selectAroundParenRight(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getAroundParenRange);
}

export function selectInnerBrace(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getInnerBraceRange);
}

export function selectAroundBrace(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getAroundBraceRange);
}

export function selectInnerBraceRight(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getInnerBraceRange);
}

export function selectAroundBraceRight(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getAroundBraceRange);
}

export function selectInnerBracket(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getInnerBracketRange);
}

export function selectAroundBracket(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getAroundBracketRange);
}

export function selectInnerBracketRight(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getInnerBracketRange);
}

export function selectAroundBracketRight(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getAroundBracketRange);
}

export function selectInnerAngle(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getInnerAngleRange);
}

export function selectAroundAngle(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getAroundAngleRange);
}

export function selectInnerAngleRight(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getInnerAngleRange);
}

export function selectAroundAngleRight(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getAroundAngleRange);
}

export function selectInnerSingleQuote(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getInnerSingleQuoteRange);
}

export function selectAroundSingleQuote(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getAroundSingleQuoteRange);
}

export function selectInnerDoubleQuote(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getInnerDoubleQuoteRange);
}

export function selectAroundDoubleQuote(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getAroundDoubleQuoteRange);
}

export function selectInnerBacktick(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getInnerBacktickRange);
}

export function selectAroundBacktick(editor = vscode.window.activeTextEditor): void {
    applyTextObjectSelection(editor, getAroundBacktickRange);
}

export function registerTextObjectCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.innerWordSelect', () => selectInnerWord()),
        vscode.commands.registerCommand('waltz.aroundWordSelect', () => selectAroundWord()),
        vscode.commands.registerCommand('waltz.innerBigWordSelect', () => selectInnerBigWord()),
        vscode.commands.registerCommand('waltz.aroundBigWordSelect', () => selectAroundBigWord()),
        vscode.commands.registerCommand('waltz.innerParenSelect', () => selectInnerParen()),
        vscode.commands.registerCommand('waltz.aroundParenSelect', () => selectAroundParen()),
        vscode.commands.registerCommand('waltz.innerParenRightSelect', () => selectInnerParenRight()),
        vscode.commands.registerCommand('waltz.aroundParenRightSelect', () => selectAroundParenRight()),
        vscode.commands.registerCommand('waltz.innerBraceSelect', () => selectInnerBrace()),
        vscode.commands.registerCommand('waltz.aroundBraceSelect', () => selectAroundBrace()),
        vscode.commands.registerCommand('waltz.innerBraceRightSelect', () => selectInnerBraceRight()),
        vscode.commands.registerCommand('waltz.aroundBraceRightSelect', () => selectAroundBraceRight()),
        vscode.commands.registerCommand('waltz.innerBracketSelect', () => selectInnerBracket()),
        vscode.commands.registerCommand('waltz.aroundBracketSelect', () => selectAroundBracket()),
        vscode.commands.registerCommand('waltz.innerBracketRightSelect', () => selectInnerBracketRight()),
        vscode.commands.registerCommand('waltz.aroundBracketRightSelect', () => selectAroundBracketRight()),
        vscode.commands.registerCommand('waltz.innerAngleSelect', () => selectInnerAngle()),
        vscode.commands.registerCommand('waltz.aroundAngleSelect', () => selectAroundAngle()),
        vscode.commands.registerCommand('waltz.innerAngleRightSelect', () => selectInnerAngleRight()),
        vscode.commands.registerCommand('waltz.aroundAngleRightSelect', () => selectAroundAngleRight()),
        vscode.commands.registerCommand('waltz.innerSingleQuoteSelect', () => selectInnerSingleQuote()),
        vscode.commands.registerCommand('waltz.aroundSingleQuoteSelect', () => selectAroundSingleQuote()),
        vscode.commands.registerCommand('waltz.innerDoubleQuoteSelect', () => selectInnerDoubleQuote()),
        vscode.commands.registerCommand('waltz.aroundDoubleQuoteSelect', () => selectAroundDoubleQuote()),
        vscode.commands.registerCommand('waltz.innerBacktickSelect', () => selectInnerBacktick()),
        vscode.commands.registerCommand('waltz.aroundBacktickSelect', () => selectAroundBacktick()),
    );
}
