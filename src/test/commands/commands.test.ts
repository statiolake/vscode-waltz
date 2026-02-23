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

        test('waltz.visualCut should delete selection and return to normal mode', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 0), new Position(0, 5));

            const vimState = await getVimState();
            await vscode.commands.executeCommand('waltz.enterVisual');
            await wait(50);

            await vscode.commands.executeCommand('waltz.visualCut');
            await wait(50);

            assert.strictEqual(doc.getText(), ' world', 'Should delete selected text');
            assert.strictEqual(vimState.mode, 'normal', 'Should return to normal mode');
        });

        test('waltz.visualYank should keep text and return to normal mode', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 0), new Position(0, 5));

            const vimState = await getVimState();
            await vscode.commands.executeCommand('waltz.enterVisual');
            await wait(50);

            await vscode.commands.executeCommand('waltz.visualYank');
            await wait(50);

            assert.strictEqual(doc.getText(), 'hello world', 'Should not modify text');
            assert.strictEqual(vimState.mode, 'normal', 'Should return to normal mode');
        });
    });

    suite('Paragraph movement', () => {
        test('waltz.paragraphDown should move to end of current paragraph', async () => {
            const doc = await vscode.workspace.openTextDocument({
                content: 'line1\nline2\n\nline4\nline5',
            });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 0), new Position(0, 0));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await wait(50);

            await vscode.commands.executeCommand('waltz.paragraphDown');
            await wait(50);

            // Should be at line 1 (end of current paragraph: line1, line2)
            assert.strictEqual(
                editor.selection.active.line,
                1,
                `Should be at end of current paragraph, got line ${editor.selection.active.line}`,
            );
        });

        test('waltz.paragraphUp should move to start of current paragraph', async () => {
            const doc = await vscode.workspace.openTextDocument({
                content: 'line1\nline2\n\nline4\nline5',
            });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(4, 0), new Position(4, 0));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await wait(50);

            await vscode.commands.executeCommand('waltz.paragraphUp');
            await wait(50);

            // Should be at line 3 (start of current paragraph: line4, line5)
            assert.strictEqual(
                editor.selection.active.line,
                3,
                `Should be at start of current paragraph, got line ${editor.selection.active.line}`,
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

    suite('Operator motion behavior', () => {
        test('waltz.delete with w should include trailing spaces unlike e', async () => {
            const docDw = await vscode.workspace.openTextDocument({ content: 'hello   world' });
            const editorDw = await vscode.window.showTextDocument(docDw);
            editorDw.selection = new Selection(new Position(0, 0), new Position(0, 0));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await wait(50);

            await vscode.commands.executeCommand('waltz.delete', { selectCommand: 'cursorWordStartRightSelect' });
            await wait(50);
            assert.strictEqual(docDw.getText(), 'world', 'dw should delete to next word start');

            const docDe = await vscode.workspace.openTextDocument({ content: 'hello   world' });
            const editorDe = await vscode.window.showTextDocument(docDe);
            editorDe.selection = new Selection(new Position(0, 0), new Position(0, 0));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await wait(50);

            await vscode.commands.executeCommand('waltz.delete', { selectCommand: 'cursorWordEndRightSelect' });
            await wait(50);
            assert.strictEqual(docDe.getText(), '   world', 'de should delete to end of word');
        });

        test('waltz.delete with W should include trailing spaces unlike E', async () => {
            const docDW = await vscode.workspace.openTextDocument({ content: 'foo-bar   baz' });
            const editorDW = await vscode.window.showTextDocument(docDW);
            editorDW.selection = new Selection(new Position(0, 0), new Position(0, 0));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await wait(50);

            await vscode.commands.executeCommand('waltz.delete', {
                selectCommand: 'waltz.cursorWhitespaceWordStartRightSelect',
            });
            await wait(50);
            assert.strictEqual(docDW.getText(), 'baz', 'dW should delete to next WORD start');

            const docDE = await vscode.workspace.openTextDocument({ content: 'foo-bar   baz' });
            const editorDE = await vscode.window.showTextDocument(docDE);
            editorDE.selection = new Selection(new Position(0, 0), new Position(0, 0));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await wait(50);

            await vscode.commands.executeCommand('waltz.delete', {
                selectCommand: 'waltz.cursorWhitespaceWordEndRightSelect',
            });
            await wait(50);
            assert.strictEqual(docDE.getText(), '   baz', 'dE should delete to end of WORD');
        });

        test('waltz.change with w/e should follow native ranges and enter insert mode', async () => {
            const docCw = await vscode.workspace.openTextDocument({ content: 'hello   world' });
            const editorCw = await vscode.window.showTextDocument(docCw);
            editorCw.selection = new Selection(new Position(0, 0), new Position(0, 0));

            const vimState = await getVimState();
            await vscode.commands.executeCommand('waltz.escapeKey');
            await wait(50);

            await vscode.commands.executeCommand('waltz.change', { selectCommand: 'cursorWordStartRightSelect' });
            await wait(50);
            assert.strictEqual(docCw.getText(), 'world', 'cw should delete to next word start');
            assert.strictEqual(vimState.mode, 'insert', 'cw should enter insert mode');

            const docCe = await vscode.workspace.openTextDocument({ content: 'hello   world' });
            const editorCe = await vscode.window.showTextDocument(docCe);
            editorCe.selection = new Selection(new Position(0, 0), new Position(0, 0));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await wait(50);

            await vscode.commands.executeCommand('waltz.change', { selectCommand: 'cursorWordEndRightSelect' });
            await wait(50);
            assert.strictEqual(docCe.getText(), '   world', 'ce should delete to end of word');
            assert.strictEqual(vimState.mode, 'insert', 'ce should enter insert mode');
        });

        test('waltz.change with W/E should follow native ranges and enter insert mode', async () => {
            const docCW = await vscode.workspace.openTextDocument({ content: 'foo-bar   baz' });
            const editorCW = await vscode.window.showTextDocument(docCW);
            editorCW.selection = new Selection(new Position(0, 0), new Position(0, 0));

            const vimState = await getVimState();
            await vscode.commands.executeCommand('waltz.escapeKey');
            await wait(50);

            await vscode.commands.executeCommand('waltz.change', {
                selectCommand: 'waltz.cursorWhitespaceWordStartRightSelect',
            });
            await wait(50);
            assert.strictEqual(docCW.getText(), 'baz', 'cW should delete to next WORD start');
            assert.strictEqual(vimState.mode, 'insert', 'cW should enter insert mode');

            const docCE = await vscode.workspace.openTextDocument({ content: 'foo-bar   baz' });
            const editorCE = await vscode.window.showTextDocument(docCE);
            editorCE.selection = new Selection(new Position(0, 0), new Position(0, 0));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await wait(50);

            await vscode.commands.executeCommand('waltz.change', {
                selectCommand: 'waltz.cursorWhitespaceWordEndRightSelect',
            });
            await wait(50);
            assert.strictEqual(docCE.getText(), '   baz', 'cE should delete to end of WORD');
            assert.strictEqual(vimState.mode, 'insert', 'cE should enter insert mode');
        });

        test('waltz.change line on last line should keep cursor on last line', async () => {
            const doc = await vscode.workspace.openTextDocument({
                content: 'first line\nsecond line\nthird line',
            });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(2, 3), new Position(2, 3));

            const vimState = await getVimState();
            await vscode.commands.executeCommand('waltz.escapeKey');
            await wait(50);

            await vscode.commands.executeCommand('waltz.change', { line: true });
            await wait(50);

            assert.strictEqual(vimState.mode, 'insert', 'S should enter insert mode');
            assert.strictEqual(
                editor.selection.active.line,
                doc.lineCount - 1,
                'Cursor should remain on the last line',
            );
        });

        test('waltz.delete with native motion target cancels existing selection first', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 0), new Position(0, 2));

            await vscode.commands.executeCommand('waltz.delete', { selectCommand: 'cursorWordStartRightSelect' });
            await wait(50);

            assert.strictEqual(
                doc.getText(),
                'heworld',
                'Should operate from active cursor, not pre-existing selection',
            );
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

            await vscode.commands.executeCommand('waltz.surround', {
                selectCommand: 'waltz.innerWordSelect',
                surroundWith: '"',
            });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), '"hello" world', 'Should wrap word in quotes');
        });

        test('surround with parentheses should wrap word in parens', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 2), new Position(0, 2));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await new Promise((resolve) => setTimeout(resolve, 50));

            await vscode.commands.executeCommand('waltz.surround', {
                selectCommand: 'waltz.innerWordSelect',
                surroundWith: '(',
            });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), '(hello) world', 'Should wrap word in parentheses');
        });

        test('surround with braces should wrap word in braces', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 2), new Position(0, 2));

            await vscode.commands.executeCommand('waltz.escapeKey');
            await new Promise((resolve) => setTimeout(resolve, 50));

            await vscode.commands.executeCommand('waltz.surround', {
                selectCommand: 'waltz.innerWordSelect',
                surroundWith: '{',
            });
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

            await vscode.commands.executeCommand('waltz.escapeKey');
            await new Promise((resolve) => setTimeout(resolve, 50));

            // Set multiple cursors inside each quoted word (after escapeKey since it resets selections)
            editor.selections = [
                new Selection(new Position(0, 3), new Position(0, 3)),
                new Selection(new Position(0, 11), new Position(0, 11)),
            ];

            await vscode.commands.executeCommand('waltz.deleteSurround', { target: '"' });
            await new Promise((resolve) => setTimeout(resolve, 50));

            assert.strictEqual(doc.getText(), 'hello world', 'Should remove quotes from both words');
        });
    });
});
