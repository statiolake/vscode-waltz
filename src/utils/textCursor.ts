import { Position, type Range, type TextDocument } from 'vscode';

/**
 * テキストドキュメントのカーソルベースの操作を提供するクラス
 *
 * VS Code API の呼び出しを最小化するため、テキスト全体を一度取得してキャッシュし、
 * オフセットベースでの効率的な文字アクセスを提供する。
 *
 * 使用例:
 * ```ts
 * const cursor = TextCursor.fromDocument(document, position);
 * const charRight = cursor.peek(1);    // カーソルの右の文字
 * const charLeft = cursor.peek(-1);    // カーソルの左の文字
 * cursor.move(1);                      // カーソルを右に移動
 * cursor.move(-1);                     // カーソルを左に移動
 * ```
 */
export class TextCursor {
    private readonly text: string;
    private readonly document: TextDocument;
    private offset: number;

    private constructor(document: TextDocument, text: string, offset: number) {
        this.document = document;
        this.text = text;
        this.offset = offset;
    }

    /**
     * ドキュメントと位置からTextCursorを作成
     */
    static fromDocument(document: TextDocument, position: Position): TextCursor {
        const text = document.getText();
        const offset = document.offsetAt(position);
        return new TextCursor(document, text, offset);
    }

    /**
     * ドキュメントとオフセットからTextCursorを作成
     */
    static fromDocumentOffset(document: TextDocument, offset: number): TextCursor {
        const text = document.getText();
        return new TextCursor(document, text, offset);
    }

    /**
     * テキスト全体を取得済みのTextCursorを複製
     * テキストのキャッシュを共有するため効率的
     */
    clone(): TextCursor {
        return new TextCursor(this.document, this.text, this.offset);
    }

    /**
     * 現在のオフセット位置を取得
     */
    getOffset(): number {
        return this.offset;
    }

    /**
     * 現在の位置をPositionとして取得
     */
    getPosition(): Position {
        return this.document.positionAt(this.offset);
    }

    /**
     * 現在の位置が文書の先頭かどうか
     */
    isAtStart(): boolean {
        return this.offset <= 0;
    }

    /**
     * 現在の位置が文書の末尾かどうか
     */
    isAtEnd(): boolean {
        return this.offset >= this.text.length;
    }

    /**
     * カーソル位置から指定方向の文字を取得（カーソルは移動しない）
     * @param delta 相対オフセット（1: 右の文字、-1: 左の文字）
     * @returns 文字、範囲外の場合は空文字列
     *
     * 注: delta=1 はカーソル位置の文字（右側）、delta=-1 はカーソルの1つ左の文字
     */
    peek(delta: 1 | -1): string {
        const targetOffset = delta === 1 ? this.offset : this.offset - 1;
        if (targetOffset < 0 || targetOffset >= this.text.length) return '';
        return this.text[targetOffset];
    }

    /**
     * 指定範囲の文字列を取得
     * @param startDelta 開始位置の相対オフセット
     * @param endDelta 終了位置の相対オフセット
     */
    peekRange(startDelta: number, endDelta: number): string {
        const start = Math.max(0, this.offset + startDelta);
        const end = Math.min(this.text.length, this.offset + endDelta);
        if (start >= end) return '';
        return this.text.slice(start, end);
    }

    /**
     * カーソルを指定方向に移動
     * @param delta 移動量（正: 右、負: 左）
     * @returns 実際に移動できたかどうか
     */
    move(delta: number): boolean {
        const newOffset = Math.max(0, Math.min(this.text.length, this.offset + delta));
        const moved = newOffset !== this.offset;
        this.offset = newOffset;
        return moved;
    }

    /**
     * カーソルを指定オフセットに移動
     */
    moveTo(offset: number): void {
        this.offset = Math.max(0, Math.min(this.text.length, offset));
    }

    /**
     * カーソルを指定位置に移動
     */
    moveToPosition(position: Position): void {
        this.offset = this.document.offsetAt(position);
    }

    /**
     * テキスト全体の長さを取得
     */
    getTextLength(): number {
        return this.text.length;
    }

    /**
     * 指定オフセット範囲のテキストを取得（絶対オフセット）
     */
    getTextByAbsoluteOffset(startOffset: number, endOffset: number): string {
        const start = Math.max(0, startOffset);
        const end = Math.min(this.text.length, endOffset);
        if (start >= end) return '';
        return this.text.slice(start, end);
    }

    /**
     * 指定範囲のテキストを取得
     */
    getTextByRange(range: Range): string {
        const startOffset = this.document.offsetAt(range.start);
        const endOffset = this.document.offsetAt(range.end);
        return this.getTextByAbsoluteOffset(startOffset, endOffset);
    }

    /**
     * ドキュメントを取得
     */
    getDocument(): TextDocument {
        return this.document;
    }

    /**
     * オフセットからPositionを取得
     */
    offsetToPosition(offset: number): Position {
        return this.document.positionAt(offset);
    }

    /**
     * Positionからオフセットを取得
     */
    positionToOffset(position: Position): number {
        return this.document.offsetAt(position);
    }

    /**
     * 行の開始オフセットを取得
     */
    getLineStartOffset(lineNumber: number): number {
        if (lineNumber < 0 || lineNumber >= this.document.lineCount) {
            return this.offset;
        }
        return this.document.offsetAt(new Position(lineNumber, 0));
    }

    /**
     * 行の終了オフセットを取得
     */
    getLineEndOffset(lineNumber: number): number {
        if (lineNumber < 0 || lineNumber >= this.document.lineCount) {
            return this.offset;
        }
        const line = this.document.lineAt(lineNumber);
        return this.document.offsetAt(line.range.end);
    }

    /**
     * 現在のオフセットの行番号を取得
     */
    getCurrentLineNumber(): number {
        return this.document.positionAt(this.offset).line;
    }

    /**
     * ドキュメントの行数を取得
     */
    getLineCount(): number {
        return this.document.lineCount;
    }
}
