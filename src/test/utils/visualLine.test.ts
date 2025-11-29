import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { Position, Selection } from 'vscode';
import { expandSelectionsToFullLines } from '../../utils/visualLine';

suite('expandSelectionsToFullLines', () => {
    test('should expand single line selection', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3' });
        const editor = await vscode.window.showTextDocument(doc);

        // Select somewhere in line2
        editor.selection = new Selection(new Position(1, 2), new Position(1, 4));

        expandSelectionsToFullLines(editor);

        // Should select entire line2 (from start to end of text, not including newline)
        assert.deepStrictEqual(editor.selection.anchor, new Position(1, 0));
        assert.deepStrictEqual(editor.selection.active, new Position(1, 5));
    });

    test('should expand multi-line selection', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3' });
        const editor = await vscode.window.showTextDocument(doc);

        // Select from line1 to line2
        editor.selection = new Selection(new Position(0, 2), new Position(1, 3));

        expandSelectionsToFullLines(editor);

        // Should select from start of line1 to end of line2
        assert.deepStrictEqual(editor.selection.anchor, new Position(0, 0));
        assert.deepStrictEqual(editor.selection.active, new Position(1, 5));
    });

    test('should expand backward selection', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3' });
        const editor = await vscode.window.showTextDocument(doc);

        // Select backward from line2 to line1 (anchor > active)
        editor.selection = new Selection(new Position(1, 3), new Position(0, 2));

        expandSelectionsToFullLines(editor);

        // Should select from end of line1 to start of line2 (backward)
        assert.deepStrictEqual(editor.selection.anchor, new Position(1, 5));
        assert.deepStrictEqual(editor.selection.active, new Position(0, 0));
    });

    test('should handle last line WITH trailing newline', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3\n' });
        const editor = await vscode.window.showTextDocument(doc);

        // Select last line (line3)
        editor.selection = new Selection(new Position(2, 2), new Position(2, 4));

        expandSelectionsToFullLines(editor);

        // Should select entire line3
        assert.deepStrictEqual(editor.selection.anchor, new Position(2, 0));
        // When there's a trailing newline, the line's range.end should be at the newline position
        const line3 = doc.lineAt(2);
        assert.deepStrictEqual(editor.selection.active, new Position(2, line3.text.length));
    });

    test('should handle last line WITHOUT trailing newline (VGy issue)', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3' });
        const editor = await vscode.window.showTextDocument(doc);

        // Select last line (line3) which has no trailing newline
        editor.selection = new Selection(new Position(2, 2), new Position(2, 4));

        expandSelectionsToFullLines(editor);

        // Should select entire line3 including the line ending
        assert.deepStrictEqual(editor.selection.anchor, new Position(2, 0));

        // The active position should be at the end of the line
        // For the last line without trailing newline, this should still include the entire line
        const line3 = doc.lineAt(2);
        assert.deepStrictEqual(editor.selection.active, new Position(2, line3.text.length));

        // Verify the selection includes the entire line content
        const selectedText = doc.getText(editor.selection);
        assert.strictEqual(selectedText, 'line3', 'Should select entire last line');
    });

    test('should handle VG (select all lines) without trailing newline', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3' });
        const editor = await vscode.window.showTextDocument(doc);

        // Select from first line to last line (VG behavior)
        editor.selection = new Selection(new Position(0, 0), new Position(2, 5));

        expandSelectionsToFullLines(editor);

        // Should select all lines
        assert.deepStrictEqual(editor.selection.anchor, new Position(0, 0));
        assert.deepStrictEqual(editor.selection.active, new Position(2, 5));

        // Verify the selection includes all content
        const selectedText = doc.getText(editor.selection);
        assert.strictEqual(selectedText, 'line1\nline2\nline3', 'Should select all lines');
    });

    test('should handle empty line', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\n\nline3' });
        const editor = await vscode.window.showTextDocument(doc);

        // Select empty line (line2)
        editor.selection = new Selection(new Position(1, 0), new Position(1, 0));

        expandSelectionsToFullLines(editor);

        // Should select the empty line
        assert.deepStrictEqual(editor.selection.anchor, new Position(1, 0));
        assert.deepStrictEqual(editor.selection.active, new Position(1, 0));
    });

    test('should handle multiple selections', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3\nline4' });
        const editor = await vscode.window.showTextDocument(doc);

        // Multiple selections on line1 and line3
        editor.selections = [
            new Selection(new Position(0, 2), new Position(0, 4)),
            new Selection(new Position(2, 1), new Position(2, 3)),
        ];

        expandSelectionsToFullLines(editor);

        // Should expand both selections
        assert.strictEqual(editor.selections.length, 2);
        assert.deepStrictEqual(editor.selections[0].anchor, new Position(0, 0));
        assert.deepStrictEqual(editor.selections[0].active, new Position(0, 5));
        assert.deepStrictEqual(editor.selections[1].anchor, new Position(2, 0));
        assert.deepStrictEqual(editor.selections[1].active, new Position(2, 5));
    });
});
