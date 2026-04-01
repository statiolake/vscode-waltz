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

async function withPreferredMode(mode: 'normal' | 'insert', run: () => Promise<void>): Promise<void> {
    const config = vscode.workspace.getConfiguration('waltz');
    const previous = config.get<'normal' | 'insert'>('preferredMode', 'normal');

    await config.update('preferredMode', mode, vscode.ConfigurationTarget.Global);
    await wait(50);

    try {
        await run();
    } finally {
        await config.update('preferredMode', previous, vscode.ConfigurationTarget.Global);
        await wait(50);
    }
}

type CursorStyleSetting = 'block' | 'block-outline' | 'line' | 'line-thin' | 'underline' | 'underline-thin';
type CursorStyleMode = 'normal' | 'insert' | 'select' | 'visual';

const cursorStyleDefaults: Record<CursorStyleMode, CursorStyleSetting> = {
    normal: 'line',
    insert: 'line-thin',
    select: 'line-thin',
    visual: 'line-thin',
};

async function withCursorStyle(
    mode: CursorStyleMode,
    style: CursorStyleSetting,
    run: () => Promise<void>,
): Promise<void> {
    const config = vscode.workspace.getConfiguration('waltz');
    const key = `cursorStyle.${mode}`;
    const previous = config.get<CursorStyleSetting>(key, cursorStyleDefaults[mode]);

    await config.update(key, style, vscode.ConfigurationTarget.Global);
    await wait(50);

    try {
        await run();
    } finally {
        await config.update(key, previous, vscode.ConfigurationTarget.Global);
        await wait(50);
    }
}

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

        test('selection created in insert mode should enter select mode', async () => {
            await withPreferredMode('insert', async () => {
                const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
                const editor = await vscode.window.showTextDocument(doc);
                editor.selection = new Selection(new Position(0, 0), new Position(0, 0));

                const vimState = await getVimState();
                await vscode.commands.executeCommand('waltz.enterInsert');
                await wait(50);
                assert.strictEqual(vimState.mode, 'insert', 'Should start in insert mode');

                editor.selection = new Selection(new Position(0, 0), new Position(0, 5));
                await wait(50);

                assert.strictEqual(vimState.mode, 'select', 'Selection from insert mode should enter select mode');
            });
        });

        test('selection created in normal mode should enter visual mode', async () => {
            await withPreferredMode('insert', async () => {
                const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
                const editor = await vscode.window.showTextDocument(doc);
                editor.selection = new Selection(new Position(0, 0), new Position(0, 0));

                const vimState = await getVimState();
                await vscode.commands.executeCommand('waltz.escapeKey');
                await wait(50);
                assert.strictEqual(vimState.mode, 'normal', 'Should start in normal mode');

                editor.selection = new Selection(new Position(0, 0), new Position(0, 5));
                await wait(50);

                assert.strictEqual(vimState.mode, 'visual', 'Selection from normal mode should enter visual mode');
            });
        });

        test('selection created in insert mode should enter visual mode when preferred mode is normal', async () => {
            await withPreferredMode('normal', async () => {
                const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
                const editor = await vscode.window.showTextDocument(doc);
                editor.selection = new Selection(new Position(0, 0), new Position(0, 0));

                const vimState = await getVimState();
                await vscode.commands.executeCommand('waltz.enterInsert');
                await wait(50);
                assert.strictEqual(vimState.mode, 'insert', 'Should start in insert mode');

                editor.selection = new Selection(new Position(0, 0), new Position(0, 5));
                await wait(50);

                assert.strictEqual(
                    vimState.mode,
                    'visual',
                    'Selection from insert mode should enter visual mode when preferred mode is normal',
                );
            });
        });

        test('waltz.toggleVisualSelect should toggle between visual and select mode', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 0), new Position(0, 5));

            const vimState = await getVimState();
            await vscode.commands.executeCommand('waltz.enterVisual');
            await wait(50);
            assert.strictEqual(vimState.mode, 'visual', 'Should start in visual mode');

            await vscode.commands.executeCommand('waltz.toggleVisualSelect');
            await wait(50);
            assert.strictEqual(vimState.mode, 'select', 'Should switch to select mode');

            await vscode.commands.executeCommand('waltz.toggleVisualSelect');
            await wait(50);
            assert.strictEqual(vimState.mode, 'visual', 'Should switch back to visual mode');
        });

        test('select mode typing should replace selection and return to insert mode', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 0), new Position(0, 5));

            const vimState = await getVimState();
            await vscode.commands.executeCommand('waltz.enterVisual');
            await wait(50);
            await vscode.commands.executeCommand('waltz.toggleVisualSelect');
            await wait(50);
            assert.strictEqual(vimState.mode, 'select', 'Should be in select mode before typing');

            await vscode.commands.executeCommand('type', { text: 'X' });
            await wait(50);

            assert.strictEqual(doc.getText(), 'X world', 'Typing in select should replace current selection');
            assert.strictEqual(vimState.mode, 'insert', 'After replacement, mode should become insert');
        });

        test('escape in select mode should return to insert mode when preferred mode is insert', async () => {
            await withPreferredMode('insert', async () => {
                const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
                const editor = await vscode.window.showTextDocument(doc);
                editor.selection = new Selection(new Position(0, 0), new Position(0, 0));

                const vimState = await getVimState();
                await vscode.commands.executeCommand('waltz.enterInsert');
                await wait(50);

                editor.selection = new Selection(new Position(0, 0), new Position(0, 5));
                await wait(50);
                assert.strictEqual(vimState.mode, 'select', 'Should be in select mode before Escape');

                await vscode.commands.executeCommand('waltz.escapeKey');
                await wait(50);

                assert.strictEqual(vimState.mode, 'insert', 'Escape in select should enter insert mode');
            });
        });

        test('escape in select mode should return to normal mode when preferred mode is normal', async () => {
            await withPreferredMode('normal', async () => {
                const doc = await vscode.workspace.openTextDocument({ content: 'hello world' });
                const editor = await vscode.window.showTextDocument(doc);
                editor.selection = new Selection(new Position(0, 0), new Position(0, 0));

                const vimState = await getVimState();
                await vscode.commands.executeCommand('waltz.enterVisual');
                await wait(50);
                await vscode.commands.executeCommand('waltz.toggleVisualSelect');
                await wait(50);
                assert.strictEqual(vimState.mode, 'select', 'Should be in select mode before Escape');

                await vscode.commands.executeCommand('waltz.escapeKey');
                await wait(50);

                assert.strictEqual(vimState.mode, 'normal', 'Escape in select should enter normal mode');
            });
        });

        test('active editor change should reapply cursor style for current mode', async () => {
            await withCursorStyle('normal', 'block', async () => {
                const doc1 = await vscode.workspace.openTextDocument({ content: 'first' });
                const editor1 = await vscode.window.showTextDocument(doc1);
                editor1.selection = new Selection(new Position(0, 0), new Position(0, 0));

                const vimState = await getVimState();
                await vscode.commands.executeCommand('waltz.escapeKey');
                await wait(50);
                assert.strictEqual(vimState.mode, 'normal', 'Should be in normal mode');
                assert.strictEqual(editor1.options.cursorStyle, vscode.TextEditorCursorStyle.Block);

                const doc2 = await vscode.workspace.openTextDocument({ content: 'second' });
                const editor2 = await vscode.window.showTextDocument(doc2);
                editor2.selection = new Selection(new Position(0, 0), new Position(0, 0));
                await wait(50);

                assert.strictEqual(vimState.mode, 'normal', 'Mode should stay normal after tab switch');
                assert.strictEqual(editor2.options.cursorStyle, vscode.TextEditorCursorStyle.Block);
            });
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

        test('waltz.change line on single-line document should not create extra line', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'single line' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 3), new Position(0, 3));

            const vimState = await getVimState();
            await vscode.commands.executeCommand('waltz.escapeKey');
            await wait(50);

            await vscode.commands.executeCommand('waltz.change', { line: true });
            await wait(50);

            assert.strictEqual(vimState.mode, 'insert', 'S should enter insert mode');
            assert.strictEqual(doc.lineCount, 1, 'Single-line document should remain single-line');
            assert.strictEqual(doc.getText(), '', 'S should clear the line content');
            assert.strictEqual(editor.selection.active.line, 0, 'Cursor should stay on the first line');
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
