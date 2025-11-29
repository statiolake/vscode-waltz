import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { Position, Range } from 'vscode';
import { adjustRangeForVisualLine } from '../../action/defs/operator';

suite('adjustRangeForVisualLine', () => {
    test('should extend range to include newline for middle line', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3' });

        // Range covering line2 (from start to end of text, not including newline)
        const range = new Range(new Position(1, 0), new Position(1, 5));

        const result = adjustRangeForVisualLine(doc, range);

        // Should extend to start of next line (to include the newline)
        assert.deepStrictEqual(result.start, new Position(1, 0));
        assert.deepStrictEqual(result.end, new Position(2, 0));

        // Verify the result includes the newline
        const text = doc.getText(result);
        assert.strictEqual(text, 'line2\n', 'Should include newline');
    });

    test('should extend range for multiple lines', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3' });

        // Range covering line1 and line2
        const range = new Range(new Position(0, 0), new Position(1, 5));

        const result = adjustRangeForVisualLine(doc, range);

        // Should extend to start of line3
        assert.deepStrictEqual(result.start, new Position(0, 0));
        assert.deepStrictEqual(result.end, new Position(2, 0));

        // Verify the result includes both lines with newlines
        const text = doc.getText(result);
        assert.strictEqual(text, 'line1\nline2\n', 'Should include both lines with newlines');
    });

    test('should handle last line WITHOUT trailing newline (VGy bug)', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3' });

        // Range covering line3 (last line, no trailing newline)
        const range = new Range(new Position(2, 0), new Position(2, 5));

        const result = adjustRangeForVisualLine(doc, range);

        // Should include the entire last line
        assert.deepStrictEqual(result.start, new Position(2, 0));
        const lastLine = doc.lineAt(2);
        assert.deepStrictEqual(result.end, lastLine.range.end, 'Should include entire last line');

        // Verify the line content is included
        const text = doc.getText(result);
        assert.strictEqual(text, 'line3', 'Should include entire last line content');
    });

    test('should handle last line WITH trailing newline', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3\n' });

        // Range covering line3 (which has a trailing newline)
        const range = new Range(new Position(2, 0), new Position(2, 5));

        const result = adjustRangeForVisualLine(doc, range);

        // Should extend to start of the empty line4
        assert.deepStrictEqual(result.start, new Position(2, 0));
        assert.deepStrictEqual(result.end, new Position(3, 0));

        // Verify the result includes line3 with its newline
        const text = doc.getText(result);
        assert.strictEqual(text, 'line3\n', 'Should include line3 with newline');
    });

    test('should handle VG (all lines) without trailing newline', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3' });

        // Range covering all lines (as VG would select)
        const range = new Range(new Position(0, 0), new Position(2, 5));

        const result = adjustRangeForVisualLine(doc, range);

        // Should include all lines
        assert.deepStrictEqual(result.start, new Position(0, 0));
        const lastLine = doc.lineAt(2);
        assert.deepStrictEqual(result.end, lastLine.range.end, 'Should include all lines through end');

        // Verify all content is included
        const text = doc.getText(result);
        assert.strictEqual(text, 'line1\nline2\nline3', 'Should include all lines including last line');
    });

    test('should handle single line without trailing newline', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'only line' });

        // Range covering the only line
        const range = new Range(new Position(0, 0), new Position(0, 9));

        const result = adjustRangeForVisualLine(doc, range);

        // Should include the entire line
        assert.deepStrictEqual(result.start, new Position(0, 0));
        const lastLine = doc.lineAt(0);
        assert.deepStrictEqual(result.end, lastLine.range.end, 'Should include entire line');

        // Verify the content is included
        const text = doc.getText(result);
        assert.strictEqual(text, 'only line', 'Should include entire line content');
    });
});
