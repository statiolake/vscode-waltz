import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { Position, Selection } from 'vscode';
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

// Helper to wait for mode change
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

suite('Native Commands Tests', () => {
    suite('Mode switching commands', () => {
        test('waltz.enterInsert should switch to insert mode', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 0), new Position(0, 0));

            // Ensure we start in normal mode
            const vimState = await getVimState();
            await vscode.commands.executeCommand('waltz.escapeKey');
            await wait(50);
            assert.strictEqual(vimState.mode, 'normal', 'Should start in normal mode');

            // Enter insert mode
            await vscode.commands.executeCommand('waltz.enterInsert');
            await wait(50);
            assert.strictEqual(vimState.mode, 'insert', 'Should be in insert mode');
        });

        test('waltz.enterVisual should switch to visual mode', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 0), new Position(0, 0));

            const vimState = await getVimState();
            await vscode.commands.executeCommand('waltz.escapeKey');
            await wait(50);

            // Enter visual mode
            await vscode.commands.executeCommand('waltz.enterVisual');
            await wait(50);
            assert.strictEqual(vimState.mode, 'visual', 'Should be in visual mode');
        });
    });

    suite('Visual mode operations', () => {
        test('waltz.visualChange should delete selection and enter insert mode', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
            const editor = await vscode.window.showTextDocument(doc);

            // Select 'hello'
            editor.selection = new Selection(new Position(0, 0), new Position(0, 5));

            const vimState = await getVimState();
            await vscode.commands.executeCommand('waltz.enterVisual');
            await wait(50);

            // Change selection
            await vscode.commands.executeCommand('waltz.visualChange');
            await wait(50);

            assert.strictEqual(doc.getText(), ' world', 'Should delete selected text');
            assert.strictEqual(vimState.mode, 'insert', 'Should enter insert mode');
        });
    });

    suite('Paragraph movement', () => {
        test('waltz.paragraphDown should move to next paragraph', async () => {
            const doc = await vscode.workspace.openTextDocument({
                content: 'line1\nline2\n\nline4\nline5',
            });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 0), new Position(0, 0));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await wait(50);

            await vscode.commands.executeCommand('waltz.paragraphDown');
            await wait(50);

            // Should be at line 3 (empty line) or line 4
            assert.ok(
                editor.selection.active.line >= 2,
                `Should have moved down, got line ${editor.selection.active.line}`,
            );
        });

        test('waltz.paragraphUp should move to previous paragraph', async () => {
            const doc = await vscode.workspace.openTextDocument({
                content: 'line1\nline2\n\nline4\nline5',
            });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(4, 0), new Position(4, 0));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await wait(50);

            await vscode.commands.executeCommand('waltz.paragraphUp');
            await wait(50);

            // Should have moved up
            assert.ok(
                editor.selection.active.line < 4,
                `Should have moved up, got line ${editor.selection.active.line}`,
            );
        });
    });

    suite('Edit commands', () => {
        test('waltz.changeToEndOfLine should delete to end and enter insert mode', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 5), new Position(0, 5));

            const vimState = await getVimState();
            await vscode.commands.executeCommand('waltz.escapeKey');
            await wait(50);

            await vscode.commands.executeCommand('waltz.changeToEndOfLine');
            await wait(50);

            assert.strictEqual(doc.getText(), 'hello', 'Should delete to end of line');
            assert.strictEqual(vimState.mode, 'insert', 'Should enter insert mode');
        });
    });
});

suite('Find Character Commands Tests', () => {
    test('waltz.repeatFindChar should repeat last f/t search', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'abcabc' });
        const editor = await vscode.window.showTextDocument(doc);
        editor.selection = new Selection(new Position(0, 0), new Position(0, 0));

        const vimState = await getVimState();
        await vscode.commands.executeCommand('waltz.escapeKey');
        await wait(50);

        // Set up lastFt manually (simulating f command)
        vimState.lastFt = {
            character: 'c',
            distance: 'further',
            direction: 'after',
        };

        // Repeat find
        await vscode.commands.executeCommand('waltz.repeatFindChar');
        await wait(50);

        // Should have moved to first 'c'
        assert.strictEqual(editor.selection.active.character, 2, 'Should move to first c');

        // Repeat again
        await vscode.commands.executeCommand('waltz.repeatFindChar');
        await wait(50);

        // Should have moved to second 'c'
        assert.strictEqual(editor.selection.active.character, 5, 'Should move to second c');
    });

    test('waltz.repeatFindCharReverse should repeat in reverse direction', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: 'abcabc' });
        const editor = await vscode.window.showTextDocument(doc);
        editor.selection = new Selection(new Position(0, 5), new Position(0, 5));

        const vimState = await getVimState();
        await vscode.commands.executeCommand('waltz.escapeKey');
        await wait(50);

        // Set up lastFt (simulating f command forward)
        vimState.lastFt = {
            character: 'a',
            distance: 'further',
            direction: 'after',
        };

        // Repeat in reverse
        await vscode.commands.executeCommand('waltz.repeatFindCharReverse');
        await wait(50);

        // Should have moved backward to 'a'
        assert.ok(editor.selection.active.character < 5, 'Should move backward');
    });
});

suite('Surround Commands Tests', () => {
    suite('waltz.surround (ys)', () => {
        test('surround command should be registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('waltz.surround'), 'waltz.surround should be registered');
        });

        test('surround with quotes should wrap word in quotes', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 2), new Position(0, 2));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await new Promise((resolve) => setTimeout(resolve, 50));

            await vscode.commands.executeCommand('waltz.surround', { textObject: 'iw', surroundWith: '"' });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), '"hello" world', 'Should wrap word in quotes');
        });

        test('surround with parentheses should wrap word in parens', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 2), new Position(0, 2));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await new Promise((resolve) => setTimeout(resolve, 50));

            await vscode.commands.executeCommand('waltz.surround', { textObject: 'iw', surroundWith: '(' });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), '(hello) world', 'Should wrap word in parentheses');
        });

        test('surround with braces should wrap word in braces', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 2), new Position(0, 2));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await new Promise((resolve) => setTimeout(resolve, 50));

            await vscode.commands.executeCommand('waltz.surround', { textObject: 'iw', surroundWith: '{' });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), '{hello} world', 'Should wrap word in braces');
        });
    });

    suite('waltz.changeSurround (cs)', () => {
        test('changeSurround command should be registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('waltz.changeSurround'), 'waltz.changeSurround should be registered');
        });

        test('changeSurround should change quotes to single quotes', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: '"hello"' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 3), new Position(0, 3));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await new Promise((resolve) => setTimeout(resolve, 50));

            await vscode.commands.executeCommand('waltz.changeSurround', { from: '"', to: "'" });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), "'hello'", 'Should change double quotes to single quotes');
        });

        test('changeSurround should change parens to brackets', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: '(hello)' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 3), new Position(0, 3));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await new Promise((resolve) => setTimeout(resolve, 50));

            await vscode.commands.executeCommand('waltz.changeSurround', { from: '(', to: '[' });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), '[hello]', 'Should change parentheses to brackets');
        });

        test('changeSurround should change braces to parens', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: '{hello}' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 3), new Position(0, 3));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await new Promise((resolve) => setTimeout(resolve, 50));

            await vscode.commands.executeCommand('waltz.changeSurround', { from: '{', to: '(' });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), '(hello)', 'Should change braces to parentheses');
        });
    });

    suite('waltz.deleteSurround (ds)', () => {
        test('deleteSurround command should be registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('waltz.deleteSurround'), 'waltz.deleteSurround should be registered');
        });

        test('deleteSurround with quotes should remove surrounding quotes', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: '"hello"' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 3), new Position(0, 3));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await new Promise((resolve) => setTimeout(resolve, 50));

            await vscode.commands.executeCommand('waltz.deleteSurround', { target: '"' });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), 'hello', 'Should remove surrounding quotes');
        });

        test('deleteSurround with parentheses should remove surrounding parens', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: '(hello)' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 3), new Position(0, 3));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await new Promise((resolve) => setTimeout(resolve, 50));

            await vscode.commands.executeCommand('waltz.deleteSurround', { target: '(' });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), 'hello', 'Should remove surrounding parentheses');
        });

        test('deleteSurround with braces should remove surrounding braces', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: '{hello}' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 3), new Position(0, 3));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await new Promise((resolve) => setTimeout(resolve, 50));

            await vscode.commands.executeCommand('waltz.deleteSurround', { target: '{' });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), 'hello', 'Should remove surrounding braces');
        });

        test('deleteSurround with brackets should remove surrounding brackets', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: '[hello]' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 3), new Position(0, 3));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await new Promise((resolve) => setTimeout(resolve, 50));

            await vscode.commands.executeCommand('waltz.deleteSurround', { target: '[' });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), 'hello', 'Should remove surrounding brackets');
        });

        test('deleteSurround with nested pairs should remove innermost', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: '((hello))' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 4), new Position(0, 4));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await new Promise((resolve) => setTimeout(resolve, 50));

            await vscode.commands.executeCommand('waltz.deleteSurround', { target: '(' });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), '(hello)', 'Should remove innermost parentheses');
        });

        test('deleteSurround with tag should remove HTML tags', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: '<div>hello</div>' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 7), new Position(0, 7));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await new Promise((resolve) => setTimeout(resolve, 50));

            await vscode.commands.executeCommand('waltz.deleteSurround', { target: 't' });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), 'hello', 'Should remove HTML tags');
        });
    });

    suite('waltz.visualSurround (S)', () => {
        test('visualSurround command should be registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('waltz.visualSurround'), 'waltz.visualSurround should be registered');
        });

        test('visualSurround should wrap selection in quotes', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
            const editor = await vscode.window.showTextDocument(doc);

            // Select 'hello'
            editor.selection = new Selection(new Position(0, 0), new Position(0, 5));

            await vscode.commands.executeCommand('waltz.enterVisual');
            await new Promise((resolve) => setTimeout(resolve, 50));

            await vscode.commands.executeCommand('waltz.visualSurround', { surroundWith: '"' });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), '"hello" world', 'Should wrap selection in quotes');
        });

        test('visualSurround should wrap selection in parentheses', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
            const editor = await vscode.window.showTextDocument(doc);

            // Select 'hello'
            editor.selection = new Selection(new Position(0, 0), new Position(0, 5));

            await vscode.commands.executeCommand('waltz.enterVisual');
            await new Promise((resolve) => setTimeout(resolve, 50));

            await vscode.commands.executeCommand('waltz.visualSurround', { surroundWith: '(' });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), '(hello) world', 'Should wrap selection in parentheses');
        });

        test('visualSurround should return to normal mode after operation', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
            const editor = await vscode.window.showTextDocument(doc);

            // Select 'hello'
            editor.selection = new Selection(new Position(0, 0), new Position(0, 5));

            const vimState = await getVimState();
            await vscode.commands.executeCommand('waltz.enterVisual');
            await new Promise((resolve) => setTimeout(resolve, 50));
            assert.strictEqual(vimState.mode, 'visual', 'Should be in visual mode');

            await vscode.commands.executeCommand('waltz.visualSurround', { surroundWith: '{' });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(vimState.mode, 'normal', 'Should return to normal mode');
        });
    });

    suite('Multi-cursor support', () => {
        test('deleteSurround should work with multiple cursors', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: '"hello" "world"' });
            const editor = await vscode.window.showTextDocument(doc);

            // Set multiple cursors inside each quoted word
            editor.selections = [
                new Selection(new Position(0, 3), new Position(0, 3)),
                new Selection(new Position(0, 11), new Position(0, 11)),
            ];

            await vscode.commands.executeCommand('waltz.escapeKey');
            await new Promise((resolve) => setTimeout(resolve, 50));

            await vscode.commands.executeCommand('waltz.deleteSurround', { target: '"' });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), 'hello world', 'Should remove quotes from both words');
        });
    });
});
