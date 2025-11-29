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
        assert.strictEqual(doc.getText(), 'foo\n\n\nbar\nfoo\n\n\nbar', 'Should preserve all blank lines when pasting');
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
