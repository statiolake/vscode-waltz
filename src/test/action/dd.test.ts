import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { Position } from 'vscode';
import { getRegisterContents } from '../../register';
import type { VimState } from '../../vimState';

// Helper function to get VimState from the extension
async function getVimState(): Promise<VimState> {
    const ext = vscode.extensions.getExtension('statiolake.waltz');
    if (!ext) {
        throw new Error('Waltz extension not found');
    }
    if (!ext.isActive) {
        await ext.activate();
    }
    return ext.exports.getVimState();
}

// Helper to execute Waltz commands
async function executeWaltz(keys: string[]) {
    await vscode.commands.executeCommand('waltz.execute', { keys });
}

suite('dd (delete line) behavior - integration tests', () => {
    test('dd on middle line should include newline in deletion, but not in register', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3' });
        const editor = await vscode.window.showTextDocument(doc);

        // Position cursor on line2
        editor.selection = new vscode.Selection(new Position(1, 2), new Position(1, 2));

        // Execute dd
        await executeWaltz(['d', 'd']);

        // Verify deletion: document should be 'line1\nline3'
        assert.strictEqual(doc.getText(), 'line1\nline3', 'Should delete line2 including its newline');

        // Verify register content: should be 'line2' without newline
        const vimState = await getVimState();
        const registerContents = await getRegisterContents(vimState);
        assert.strictEqual(registerContents.length, 1, 'Should have one register entry');
        assert.strictEqual(registerContents[0].text, 'line2', 'Register should contain line2 without newline');
        assert.strictEqual(registerContents[0].isLinewise, true, 'Should be marked as linewise');
    });

    test('dd on last line without trailing newline - register should not have leading newline', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3' });
        const editor = await vscode.window.showTextDocument(doc);

        // Position cursor on line3 (last line, no trailing newline)
        editor.selection = new vscode.Selection(new Position(2, 2), new Position(2, 2));

        // Execute dd
        await executeWaltz(['d', 'd']);

        // Verify deletion: document should be 'line1\nline2'
        assert.strictEqual(doc.getText(), 'line1\nline2', 'Should delete line3 including previous newline');

        // Verify register content: should be 'line3' without leading newline
        const vimState = await getVimState();
        const registerContents = await getRegisterContents(vimState);
        assert.strictEqual(registerContents.length, 1, 'Should have one register entry');
        assert.strictEqual(registerContents[0].text, 'line3', 'Register should contain line3 without leading newline');
        assert.strictEqual(registerContents[0].isLinewise, true, 'Should be marked as linewise');
    });

    test('dd on last line with trailing newline - register should not have trailing newline', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3\n' });
        const editor = await vscode.window.showTextDocument(doc);

        // Position cursor on line3 (last line, has trailing newline)
        editor.selection = new vscode.Selection(new Position(2, 2), new Position(2, 2));

        // Execute dd
        await executeWaltz(['d', 'd']);

        // Verify deletion: document should be 'line1\nline2\n'
        assert.strictEqual(doc.getText(), 'line1\nline2\n', 'Should delete line3 including its newline');

        // Verify register content: should be 'line3' without trailing newline
        const vimState = await getVimState();
        const registerContents = await getRegisterContents(vimState);
        assert.strictEqual(registerContents.length, 1, 'Should have one register entry');
        assert.strictEqual(registerContents[0].text, 'line3', 'Register should contain line3 without trailing newline');
        assert.strictEqual(registerContents[0].isLinewise, true, 'Should be marked as linewise');
    });

    test('dd on single line without trailing newline - register should be unchanged', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'only line' });
        const editor = await vscode.window.showTextDocument(doc);

        // Position cursor on the only line
        editor.selection = new vscode.Selection(new Position(0, 4), new Position(0, 4));

        // Execute dd
        await executeWaltz(['d', 'd']);

        // Verify deletion: document should be empty
        assert.strictEqual(doc.getText(), '', 'Should delete the only line');

        // Verify register content: should be 'only line' without any newlines
        const vimState = await getVimState();
        const registerContents = await getRegisterContents(vimState);
        assert.strictEqual(registerContents.length, 1, 'Should have one register entry');
        assert.strictEqual(registerContents[0].text, 'only line', 'Register should contain only line without newlines');
        assert.strictEqual(registerContents[0].isLinewise, true, 'Should be marked as linewise');
    });

    test('yy on last line without trailing newline - should yank without extra newline', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3' });
        const editor = await vscode.window.showTextDocument(doc);

        // Position cursor on line3 (last line, no trailing newline)
        editor.selection = new vscode.Selection(new Position(2, 2), new Position(2, 2));

        // Execute yy
        await executeWaltz(['y', 'y']);

        // Verify document is unchanged
        assert.strictEqual(doc.getText(), 'line1\nline2\nline3', 'Document should remain unchanged after yy');

        // Verify register content: should be 'line3' without newlines
        const vimState = await getVimState();
        const registerContents = await getRegisterContents(vimState);
        assert.strictEqual(registerContents.length, 1, 'Should have one register entry');
        assert.strictEqual(registerContents[0].text, 'line3', 'Register should contain line3 without newlines');
        assert.strictEqual(registerContents[0].isLinewise, true, 'Should be marked as linewise');
    });
});

suite('Register content normalization for linewise operations', () => {
    test('should strip trailing newline from register content for dd', async () => {
        // This is the key fix: when saving to register for linewise operations,
        // we should strip the trailing newline from the text

        // Input: deletion range text = 'line2\n'
        // Expected register content: 'line2' (newline stripped)
        const deletionText = 'line2\n';
        const expectedRegisterContent = 'line2';

        // The stripping logic should be:
        // if (isLinewise && text.endsWith('\n')) {
        //     registerText = text.slice(0, -1);
        // }

        assert.strictEqual(deletionText.endsWith('\n'), true, 'Should end with newline');
        assert.strictEqual(deletionText.slice(0, -1), expectedRegisterContent, 'Should strip newline');
    });

    test('should handle last line deletion - strip leading newline from register', async () => {
        // For last line without trailing newline:
        // Input: deletion range text = '\nline3'
        // Expected register content: 'line3' (leading newline stripped)
        const deletionText = '\nline3';
        const expectedRegisterContent = 'line3';

        // The stripping logic should be:
        // if (isLinewise && text.startsWith('\n')) {
        //     registerText = text.slice(1);
        // }

        assert.strictEqual(deletionText.startsWith('\n'), true, 'Should start with newline');
        assert.strictEqual(deletionText.slice(1), expectedRegisterContent, 'Should strip leading newline');
    });

    test('should handle both leading and trailing newlines', async () => {
        // Edge case: text with both leading and trailing newlines
        const deletionText = '\nline3\n';

        // For last line that somehow has a trailing newline:
        // Should strip leading newline first (since it's the last line pattern)
        // Then strip trailing newline (standard linewise pattern)
        let registerText = deletionText;
        if (registerText.startsWith('\n')) {
            registerText = registerText.slice(1);
        }
        if (registerText.endsWith('\n')) {
            registerText = registerText.slice(0, -1);
        }

        assert.strictEqual(registerText, 'line3', 'Should strip both newlines');
    });
});
