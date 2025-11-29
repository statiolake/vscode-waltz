import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { Position } from 'vscode';
import { newWholeLineTextObject } from '../../textObject/textObjectBuilder';
import { createTestContext } from '../extension.test';

suite('newWholeLineTextObject', () => {
    test('should select middle line with includeLineBreak', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3' });
        const editor = await vscode.window.showTextDocument(doc);

        const textObject = newWholeLineTextObject({ keys: ['d'], includeLineBreak: true });
        const context = createTestContext(editor, doc);

        // Position on line2
        const position = new Position(1, 2);
        const result = textObject(context, ['d'], position);

        assert.strictEqual(result.result, 'match');
        if (result.result === 'match') {
            const text = doc.getText(result.data.range);
            // Should include line2 and its newline
            assert.strictEqual(text, 'line2\n', 'Should include newline for middle line');
            assert.strictEqual(result.data.isLinewise, true, 'Should be linewise');
        }
    });

    test('should select first line with includeLineBreak', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3' });
        const editor = await vscode.window.showTextDocument(doc);

        const textObject = newWholeLineTextObject({ keys: ['d'], includeLineBreak: true });
        const context = createTestContext(editor, doc);

        // Position on line1
        const position = new Position(0, 2);
        const result = textObject(context, ['d'], position);

        assert.strictEqual(result.result, 'match');
        if (result.result === 'match') {
            const text = doc.getText(result.data.range);
            // Should include line1 and its newline
            assert.strictEqual(text, 'line1\n', 'Should include newline for first line');
            assert.strictEqual(result.data.isLinewise, true, 'Should be linewise');
        }
    });

    test('should select last line WITHOUT trailing newline (dd fix)', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3' });
        const editor = await vscode.window.showTextDocument(doc);

        const textObject = newWholeLineTextObject({ keys: ['d'], includeLineBreak: true });
        const context = createTestContext(editor, doc);

        // Position on line3 (last line)
        const position = new Position(2, 2);
        const result = textObject(context, ['d'], position);

        assert.strictEqual(result.result, 'match');
        if (result.result === 'match') {
            // For dd to work correctly (delete the entire line), we need to
            // also delete the newline from the previous line
            // Expected behavior: should include '\nline3' (newline from line2 + line3 content)
            const text = doc.getText(result.data.range);
            assert.strictEqual(
                text,
                '\nline3',
                'Should include newline from previous line for last line without trailing newline',
            );

            // Verify the range
            assert.deepStrictEqual(result.data.range.start, new Position(1, 5), 'Should start at end of line2');
            assert.deepStrictEqual(result.data.range.end, new Position(2, 5), 'Should end at end of line3');
        }
    });

    test('should select last line WITH trailing newline', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3\n' });
        const editor = await vscode.window.showTextDocument(doc);

        const textObject = newWholeLineTextObject({ keys: ['d'], includeLineBreak: true });
        const context = createTestContext(editor, doc);

        // Position on line3 (last line with trailing newline)
        const position = new Position(2, 2);
        const result = textObject(context, ['d'], position);

        assert.strictEqual(result.result, 'match');
        if (result.result === 'match') {
            const text = doc.getText(result.data.range);
            // Should include line3 and its newline
            assert.strictEqual(text, 'line3\n', 'Should include newline for last line with trailing newline');
            assert.strictEqual(result.data.isLinewise, true, 'Should be linewise');
        }
    });

    test('should select single line WITHOUT trailing newline', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'only line' });
        const editor = await vscode.window.showTextDocument(doc);

        const textObject = newWholeLineTextObject({ keys: ['d'], includeLineBreak: true });
        const context = createTestContext(editor, doc);

        // Position on the only line
        const position = new Position(0, 4);
        const result = textObject(context, ['d'], position);

        assert.strictEqual(result.result, 'match');
        if (result.result === 'match') {
            const text = doc.getText(result.data.range);
            // Current behavior: only includes the line content (no newline to include)
            assert.strictEqual(text, 'only line', 'Only includes line content');
            // This is acceptable for a single-line file
        }
    });

    test('should work with includeLineBreak: false', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3' });
        const editor = await vscode.window.showTextDocument(doc);

        const textObject = newWholeLineTextObject({ keys: ['c'], includeLineBreak: false });
        const context = createTestContext(editor, doc);

        // Position on line2
        const position = new Position(1, 2);
        const result = textObject(context, ['c'], position);

        assert.strictEqual(result.result, 'match');
        if (result.result === 'match') {
            const text = doc.getText(result.data.range);
            // Should NOT include newline
            assert.strictEqual(text, 'line2', 'Should NOT include newline when includeLineBreak is false');
            assert.strictEqual(result.data.isLinewise, true, 'Should still be linewise');
        }
    });
});
