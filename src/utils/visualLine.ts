import { Position, Range, Selection, type TextDocument } from 'vscode';
import { findNextLineStart } from './positionFinder';

/**
 * Visual Line モード用に Range を行全体に拡張する
 * selection が行の途中からでも、行全体を含む Range を返す
 * 改行文字を含む Range を返す（operator 用）
 */
export const adjustRangeForVisualLine = (document: TextDocument, range: Range): Range => {
    const lineStart = new Position(range.start.line, 0);
    const nextLineStart = findNextLineStart(document, range.end);
    return new Range(lineStart, nextLineStart);
};

/**
 * Visual Line モード用に Selection を行全体に拡張する
 */
export const expandSelectionToFullLines = (document: TextDocument, selection: Selection): Selection => {
    const adjustedRange = adjustRangeForVisualLine(document, selection);
    return new Selection(adjustedRange.start, adjustedRange.end);
};
