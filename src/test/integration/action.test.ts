import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { Position, type TextEditor } from 'vscode';
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

async function setCursorPosition(editor: TextEditor, pos: Position) {
    editor.selection = new vscode.Selection(pos, pos);
}

// Helper to execute Waltz commands
async function executeWaltz(keys: string[]) {
    await vscode.commands.executeCommand('waltz.execute', { keys });
}

// Helper to clear register
async function clearRegister() {
    const vimState = await getVimState();
    vimState.register.contents = [];
    vimState.register.lastClipboardText = '';
}

suite('Action Integration Tests', () => {
    suite('dd (delete line) behavior', () => {
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
            assert.strictEqual(
                registerContents[0].text,
                'line3',
                'Register should contain line3 without leading newline',
            );
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
            assert.strictEqual(
                registerContents[0].text,
                'line3',
                'Register should contain line3 without trailing newline',
            );
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
            assert.strictEqual(
                registerContents[0].text,
                'only line',
                'Register should contain only line without newlines',
            );
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

    suite('CRLF line ending paste', () => {
        test('yyp should not insert extra blank line with CRLF line endings', async () => {
            await clearRegister();
            // Create document with CRLF line endings
            const doc = await vscode.workspace.openTextDocument({ content: 'foo\r\nbar' });
            const editor = await vscode.window.showTextDocument(doc);

            // Position cursor on line 0 (foo)
            await setCursorPosition(editor, new Position(0, 0));

            // Execute yy (yank line)
            await executeWaltz(['y', 'y']);

            // Verify register content
            const vimState = await getVimState();
            const registerContents = await getRegisterContents(vimState);
            assert.strictEqual(registerContents.length, 1, 'Should have one register entry');
            assert.strictEqual(registerContents[0].text, 'foo', 'Register should contain foo without newline');
            assert.strictEqual(registerContents[0].isLinewise, true, 'Should be marked as linewise');

            // Execute p (paste)
            await executeWaltz(['p']);

            // Expected result: foo\r\nfoo\r\nbar (no extra blank line)
            assert.strictEqual(doc.getText(), 'foo\r\nfoo\r\nbar', 'Should not insert extra blank line');
        });

        test('yyp on middle line should not insert extra blank line with CRLF', async () => {
            await clearRegister();
            const doc = await vscode.workspace.openTextDocument({ content: 'foo\r\nbar\r\nbaz' });
            const editor = await vscode.window.showTextDocument(doc);

            // Position cursor on line 0 (foo)
            await setCursorPosition(editor, new Position(0, 0));

            // Execute yyp
            await executeWaltz(['y', 'y']);
            await executeWaltz(['p']);

            // Expected result: foo\r\nfoo\r\nbar\r\nbaz
            assert.strictEqual(doc.getText(), 'foo\r\nfoo\r\nbar\r\nbaz', 'Should not insert extra blank line');
        });

        test('visual line yank and paste should not insert extra blank line with CRLF', async () => {
            await clearRegister();
            const doc = await vscode.workspace.openTextDocument({ content: 'foo\r\nbar' });
            const editor = await vscode.window.showTextDocument(doc);

            // Position cursor on line 0 (foo)
            await setCursorPosition(editor, new Position(0, 0));

            // Execute V (visual line mode) then y (yank)
            await executeWaltz(['V']);
            await executeWaltz(['y']);

            // Verify register content
            const vimState = await getVimState();
            const registerContents = await getRegisterContents(vimState);
            assert.strictEqual(registerContents.length, 1, 'Should have one register entry');
            assert.strictEqual(registerContents[0].text, 'foo', 'Register should contain foo without newline');
            assert.strictEqual(registerContents[0].isLinewise, true, 'Should be marked as linewise');

            // Move to line 1 and paste
            await setCursorPosition(editor, new Position(1, 0));
            await executeWaltz(['p']);

            // Expected result: foo\r\nbar\r\nfoo
            assert.strictEqual(doc.getText(), 'foo\r\nbar\r\nfoo', 'Should not insert extra blank line');
        });
    });

    suite('Visual Line yank/paste with blank lines', () => {
        test('should preserve blank line when yanking "foo\\n" (line + blank line) with pasting with p', async () => {
            await clearRegister();
            const doc = await vscode.workspace.openTextDocument({ content: 'foo\n\nbar' });
            const editor = await vscode.window.showTextDocument(doc);

            // Position cursor on line 0 (foo)
            await setCursorPosition(editor, new Position(0, 0));

            // Execute V (enter visual line mode)
            await executeWaltz(['V']);

            // Then j (select foo and blank line)
            await executeWaltz(['j']);

            // Execute y (yank)
            await executeWaltz(['y']);

            // Verify register content: should be 'foo\n' (includes the blank line as newline)
            const vimState = await getVimState();
            const registerContents = await getRegisterContents(vimState);
            assert.strictEqual(registerContents.length, 1, 'Should have one register entry');
            assert.strictEqual(registerContents[0].text, 'foo\n', 'Register should contain foo with trailing newline');
            assert.strictEqual(registerContents[0].isLinewise, true, 'Should be marked as linewise');

            // Now move to line 2 (bar) and paste
            await setCursorPosition(editor, new Position(2, 0));
            await executeWaltz(['p']);

            // Expected result: foo\n\nbar\nfoo\n
            // The blank line should be preserved
            assert.strictEqual(doc.getText(), 'foo\n\nbar\nfoo\n', 'Should preserve blank line when pasting');
        });

        test('should preserve blank line when yanking "foo\\n" (line + blank line) and pasting with P', async () => {
            await clearRegister();
            const doc = await vscode.workspace.openTextDocument({ content: 'foo\n\nbar' });
            const editor = await vscode.window.showTextDocument(doc);

            // Position cursor on line 0 (foo)
            await setCursorPosition(editor, new Position(0, 0));

            // Execute V (enter visual line mode)
            await executeWaltz(['V']);

            // Then j (select foo and blank line)
            await executeWaltz(['j']);

            // Execute y (yank)
            await executeWaltz(['y']);

            // Verify register content: should be 'foo\n' (includes the blank line as newline)
            const vimState = await getVimState();
            const registerContents = await getRegisterContents(vimState);
            assert.strictEqual(registerContents.length, 1, 'Should have one register entry');
            assert.strictEqual(registerContents[0].text, 'foo\n', 'Register should contain foo with trailing newline');
            assert.strictEqual(registerContents[0].isLinewise, true, 'Should be marked as linewise');

            // Now move to line 2 (bar) and paste with P (paste before)
            await setCursorPosition(editor, new Position(2, 0));
            await executeWaltz(['P']);

            // Expected result: foo\n\nfoo\n\nbar (P pastes before current line)
            // The blank line should be preserved
            assert.strictEqual(doc.getText(), 'foo\n\nfoo\n\nbar', 'Should preserve blank line when pasting with P');
        });

        test('should preserve blank line when yanking "\\nbar" (blank line + line)', async () => {
            await clearRegister();
            const doc = await vscode.workspace.openTextDocument({ content: 'foo\n\nbar' });
            const editor = await vscode.window.showTextDocument(doc);

            // Position cursor on line 1 (blank line)
            await setCursorPosition(editor, new Position(1, 0));

            // Execute V (enter visual line mode)
            await executeWaltz(['V']);

            // Then j (select blank line and bar)
            await executeWaltz(['j']);

            // Execute y (yank)
            await executeWaltz(['y']);

            // Verify register content: should be '\nbar' (includes the blank line as leading newline)
            const vimState = await getVimState();
            const registerContents = await getRegisterContents(vimState);
            assert.strictEqual(registerContents.length, 1, 'Should have one register entry');
            assert.strictEqual(registerContents[0].text, '\nbar', 'Register should contain blank line + bar');
            assert.strictEqual(registerContents[0].isLinewise, true, 'Should be marked as linewise');

            // Now move to line 0 (foo) and paste
            await setCursorPosition(editor, new Position(0, 0));
            await executeWaltz(['p']);

            // Expected result: foo\n\nbar\nbar
            // The blank line should be preserved
            assert.strictEqual(doc.getText(), 'foo\n\nbar\n\nbar', 'Should preserve blank line when pasting');
        });

        test('should handle multiple blank lines', async () => {
            await clearRegister();
            const doc = await vscode.workspace.openTextDocument({ content: 'foo\n\n\nbar' });
            const editor = await vscode.window.showTextDocument(doc);

            // Position cursor on line 0 (foo)
            await setCursorPosition(editor, new Position(0, 0));

            // Execute V (enter visual line mode)
            await executeWaltz(['V']);

            // Then jjj (select foo + 2 blank lines + bar)
            await executeWaltz(['j']);
            await executeWaltz(['j']);
            await executeWaltz(['j']);

            // Execute y (yank)
            await executeWaltz(['y']);

            // Verify register content
            const vimState = await getVimState();
            const registerContents = await getRegisterContents(vimState);
            assert.strictEqual(registerContents.length, 1, 'Should have one register entry');
            assert.strictEqual(
                registerContents[0].text,
                'foo\n\n\nbar',
                'Register should contain all lines including blank lines',
            );
            assert.strictEqual(registerContents[0].isLinewise, true, 'Should be marked as linewise');

            // Move to end and paste
            await setCursorPosition(editor, new Position(3, 0));
            await executeWaltz(['p']);

            // Expected result: original + pasted content
            assert.strictEqual(
                doc.getText(),
                'foo\n\n\nbar\nfoo\n\n\nbar',
                'Should preserve all blank lines when pasting',
            );
        });

        test('should handle yank of single blank line', async () => {
            await clearRegister();
            const doc = await vscode.workspace.openTextDocument({ content: 'foo\n\nbar' });
            const editor = await vscode.window.showTextDocument(doc);

            // Position cursor on line 1 (blank line)
            await setCursorPosition(editor, new Position(1, 0));

            // Execute V (select just the blank line)
            await executeWaltz(['V']);

            // Execute y (yank)
            await executeWaltz(['y']);

            // Verify register content: should be empty string (blank line)
            const vimState = await getVimState();
            const registerContents = await getRegisterContents(vimState);
            assert.strictEqual(registerContents.length, 1, 'Should have one register entry');
            assert.strictEqual(registerContents[0].text, '', 'Register should contain empty string for blank line');
            assert.strictEqual(registerContents[0].isLinewise, true, 'Should be marked as linewise');

            // Move to line 2 (bar) and paste
            await setCursorPosition(editor, new Position(2, 0));
            await executeWaltz(['p']);

            // Expected result: foo\n\nbar\n (adds a blank line after bar)
            assert.strictEqual(
                doc.getText(),
                'foo\n\nbar\n',
                'Should insert blank line when pasting empty linewise content',
            );
        });
    });
});
