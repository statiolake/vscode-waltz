import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { Position } from 'vscode';
import { buildTextObjects } from '../../textObject/textObjects';
import { createTestContext } from '../extension.test';

suite('Paragraph Text Objects (ip/ap)', () => {
    suite('ip (inner paragraph)', () => {
        test('should select current paragraph in middle of text', async () => {
            const content = 'first paragraph\nstill first\n\nsecond paragraph\nstill second\n\nthird paragraph';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            const textObjects = buildTextObjects([]);
            const ipTextObject = textObjects.find((to) => {
                const result = to(createTestContext(editor, doc), ['i', 'p'], new Position(0, 0));
                return result.result === 'match' || result.result === 'needsMoreKey';
            });

            assert.ok(ipTextObject, 'Should find ip text object');

            const context = createTestContext(editor, doc);

            // Test cursor on second paragraph (line 3)
            const position = new Position(3, 5);
            const result = ipTextObject(context, ['i', 'p'], position);

            assert.strictEqual(result.result, 'match');
            if (result.result === 'match') {
                const text = doc.getText(result.data.range);
                assert.strictEqual(text, 'second paragraph\nstill second\n', 'Should select only the second paragraph');
            }
        });

        test('should select first paragraph', async () => {
            const content = 'first paragraph\nstill first\n\nsecond paragraph';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            const textObjects = buildTextObjects([]);
            const ipTextObject = textObjects.find((to) => {
                const result = to(createTestContext(editor, doc), ['i', 'p'], new Position(0, 0));
                return result.result === 'match' || result.result === 'needsMoreKey';
            });

            assert.ok(ipTextObject, 'Should find ip text object');

            const context = createTestContext(editor, doc);
            const position = new Position(0, 0);
            const result = ipTextObject(context, ['i', 'p'], position);

            assert.strictEqual(result.result, 'match');
            if (result.result === 'match') {
                const text = doc.getText(result.data.range);
                assert.strictEqual(text, 'first paragraph\nstill first\n', 'Should select first paragraph');
            }
        });

        test('should select last paragraph', async () => {
            const content = 'first paragraph\n\nlast paragraph\nstill last';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            const textObjects = buildTextObjects([]);
            const ipTextObject = textObjects.find((to) => {
                const result = to(createTestContext(editor, doc), ['i', 'p'], new Position(0, 0));
                return result.result === 'match' || result.result === 'needsMoreKey';
            });

            const context = createTestContext(editor, doc);
            const position = new Position(2, 5);
            assert.ok(ipTextObject, 'Should find ip text object');

            const result = ipTextObject(context, ['i', 'p'], position);

            assert.strictEqual(result.result, 'match');
            if (result.result === 'match') {
                const text = doc.getText(result.data.range);
                assert.strictEqual(text, 'last paragraph\nstill last', 'Should select last paragraph');
            }
        });

        test('should select single line paragraph', async () => {
            const content = 'first\n\nsingle line\n\nlast';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            const textObjects = buildTextObjects([]);
            const ipTextObject = textObjects.find((to) => {
                const result = to(createTestContext(editor, doc), ['i', 'p'], new Position(0, 0));
                return result.result === 'match' || result.result === 'needsMoreKey';
            });

            const context = createTestContext(editor, doc);
            const position = new Position(2, 3);
            assert.ok(ipTextObject, 'Should find ip text object');

            const result = ipTextObject(context, ['i', 'p'], position);

            assert.strictEqual(result.result, 'match');
            if (result.result === 'match') {
                const text = doc.getText(result.data.range);
                assert.strictEqual(text, 'single line\n', 'Should select single line paragraph');
            }
        });

        test('should select entire document when no blank lines', async () => {
            const content = 'line 1\nline 2\nline 3';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            const textObjects = buildTextObjects([]);
            const ipTextObject = textObjects.find((to) => {
                const result = to(createTestContext(editor, doc), ['i', 'p'], new Position(0, 0));
                return result.result === 'match' || result.result === 'needsMoreKey';
            });

            const context = createTestContext(editor, doc);
            const position = new Position(1, 3);
            assert.ok(ipTextObject, 'Should find ip text object');

            const result = ipTextObject(context, ['i', 'p'], position);

            assert.strictEqual(result.result, 'match');
            if (result.result === 'match') {
                const text = doc.getText(result.data.range);
                assert.strictEqual(text, 'line 1\nline 2\nline 3', 'Should select entire document');
            }
        });

        test('should handle cursor on blank line', async () => {
            const content = 'first\n\nsecond';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            const textObjects = buildTextObjects([]);
            const ipTextObject = textObjects.find((to) => {
                const result = to(createTestContext(editor, doc), ['i', 'p'], new Position(0, 0));
                return result.result === 'match' || result.result === 'needsMoreKey';
            });

            const context = createTestContext(editor, doc);
            // Cursor on blank line (line 1)
            const position = new Position(1, 0);
            assert.ok(ipTextObject, 'Should find ip text object');

            const result = ipTextObject(context, ['i', 'p'], position);

            assert.strictEqual(result.result, 'match');
            if (result.result === 'match') {
                const text = doc.getText(result.data.range);
                // When on blank line, should select just the newline
                assert.strictEqual(text, '\n', 'Should select just the newline when on blank line');
            }
        });
    });

    suite('ap (around paragraph)', () => {
        test('should select current paragraph including trailing blank line', async () => {
            const content = 'first paragraph\nstill first\n\nsecond paragraph\nstill second\n\nthird paragraph';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            const textObjects = buildTextObjects([]);
            const apTextObject = textObjects.find((to) => {
                const result = to(createTestContext(editor, doc), ['a', 'p'], new Position(0, 0));
                return result.result === 'match' || result.result === 'needsMoreKey';
            });

            assert.ok(apTextObject, 'Should find ap text object');

            const context = createTestContext(editor, doc);

            // Test cursor on second paragraph (line 3)
            const position = new Position(3, 5);
            const result = apTextObject(context, ['a', 'p'], position);

            assert.strictEqual(result.result, 'match');
            if (result.result === 'match') {
                const text = doc.getText(result.data.range);
                // Should include the blank line after the paragraph
                assert.strictEqual(
                    text,
                    'second paragraph\nstill second\n\n',
                    'Should select paragraph with trailing blank line',
                );
            }
        });

        test('should select first paragraph including trailing blank line', async () => {
            const content = 'first paragraph\nstill first\n\nsecond paragraph';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            const textObjects = buildTextObjects([]);
            const apTextObject = textObjects.find((to) => {
                const result = to(createTestContext(editor, doc), ['a', 'p'], new Position(0, 0));
                return result.result === 'match' || result.result === 'needsMoreKey';
            });

            const context = createTestContext(editor, doc);
            const position = new Position(0, 0);
            assert.ok(apTextObject, 'Should find ap text object');

            const result = apTextObject(context, ['a', 'p'], position);

            assert.strictEqual(result.result, 'match');
            if (result.result === 'match') {
                const text = doc.getText(result.data.range);
                assert.strictEqual(
                    text,
                    'first paragraph\nstill first\n\n',
                    'Should select first paragraph with trailing blank line',
                );
            }
        });

        test('should select last paragraph without extra blank line', async () => {
            const content = 'first paragraph\n\nlast paragraph\nstill last';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            const textObjects = buildTextObjects([]);
            const apTextObject = textObjects.find((to) => {
                const result = to(createTestContext(editor, doc), ['a', 'p'], new Position(0, 0));
                return result.result === 'match' || result.result === 'needsMoreKey';
            });

            const context = createTestContext(editor, doc);
            const position = new Position(2, 5);
            assert.ok(apTextObject, 'Should find ap text object');

            const result = apTextObject(context, ['a', 'p'], position);

            assert.strictEqual(result.result, 'match');
            if (result.result === 'match') {
                const text = doc.getText(result.data.range);
                // Last paragraph - should not add blank line after it
                assert.strictEqual(text, 'last paragraph\nstill last', 'Should select last paragraph only');
            }
        });

        test('should handle multiple blank lines', async () => {
            const content = 'first\n\n\nsecond';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            const textObjects = buildTextObjects([]);
            const apTextObject = textObjects.find((to) => {
                const result = to(createTestContext(editor, doc), ['a', 'p'], new Position(0, 0));
                return result.result === 'match' || result.result === 'needsMoreKey';
            });

            const context = createTestContext(editor, doc);
            const position = new Position(0, 0);
            assert.ok(apTextObject, 'Should find ap text object');

            const result = apTextObject(context, ['a', 'p'], position);

            assert.strictEqual(result.result, 'match');
            if (result.result === 'match') {
                const text = doc.getText(result.data.range);
                // Should include one blank line after paragraph
                assert.strictEqual(text, 'first\n\n', 'Should select paragraph with one trailing blank line');
            }
        });
    });

    suite('Integration with operators', () => {
        test('dip should delete inner paragraph', async () => {
            const content = 'first\n\nsecond line 1\nsecond line 2\n\nthird';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            // Set cursor on second paragraph
            editor.selection = new vscode.Selection(new Position(2, 5), new Position(2, 5));

            // Execute dip
            await vscode.commands.executeCommand('waltz.execute', { keys: ['d', 'i', 'p'] });

            // Should delete the second paragraph but leave blank lines
            assert.strictEqual(doc.getText(), 'first\n\n\nthird', 'Should delete inner paragraph, leaving blank lines');
        });

        test('dap should delete paragraph including blank line', async () => {
            const content = 'first\n\nsecond line 1\nsecond line 2\n\nthird';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            // Set cursor on second paragraph
            editor.selection = new vscode.Selection(new Position(2, 5), new Position(2, 5));

            // Execute dap
            await vscode.commands.executeCommand('waltz.execute', { keys: ['d', 'a', 'p'] });

            // Should delete the second paragraph including trailing blank line
            assert.strictEqual(doc.getText(), 'first\n\nthird', 'Should delete paragraph with trailing blank line');
        });

        test('yip should yank inner paragraph', async () => {
            const content = 'first\n\nsecond line 1\nsecond line 2\n\nthird';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            // Set cursor on second paragraph
            editor.selection = new vscode.Selection(new Position(2, 5), new Position(2, 5));

            // Execute yip
            await vscode.commands.executeCommand('waltz.execute', { keys: ['y', 'i', 'p'] });

            // Document should be unchanged
            assert.strictEqual(
                doc.getText(),
                'first\n\nsecond line 1\nsecond line 2\n\nthird',
                'Document should be unchanged after yank',
            );
        });

        test.skip('vip should select inner paragraph in visual mode', async () => {
            // Skipped: Requires full waltz extension integration
            // This would test: v + ip selection
            const content = 'first\n\nsecond line 1\nsecond line 2\n\nthird';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            // Set cursor on second paragraph
            editor.selection = new vscode.Selection(new Position(2, 5), new Position(2, 5));

            // Execute vip
            await vscode.commands.executeCommand('waltz.execute', { keys: ['v', 'i', 'p'] });

            // Check selection
            const selection = editor.selection;
            const selectedText = doc.getText(selection);
            assert.strictEqual(
                selectedText,
                'second line 1\nsecond line 2\n',
                'Should select inner paragraph in visual mode',
            );
        });

        test.skip('vap should select paragraph with blank line in visual mode', async () => {
            // Skipped: Requires full waltz extension integration
            // This would test: v + ap selection
            const content = 'first\n\nsecond line 1\nsecond line 2\n\nthird';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            // Set cursor on second paragraph
            editor.selection = new vscode.Selection(new Position(2, 5), new Position(2, 5));

            // Execute vap
            await vscode.commands.executeCommand('waltz.execute', { keys: ['v', 'a', 'p'] });

            // Check selection
            const selection = editor.selection;
            const selectedText = doc.getText(selection);
            assert.strictEqual(
                selectedText,
                'second line 1\nsecond line 2\n\n',
                'Should select paragraph with trailing blank line in visual mode',
            );
        });
    });

    suite('Edge cases', () => {
        test('should handle empty document', async () => {
            const content = '';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            const textObjects = buildTextObjects([]);
            const ipTextObject = textObjects.find((to) => {
                const result = to(createTestContext(editor, doc), ['i', 'p'], new Position(0, 0));
                return result.result === 'match' || result.result === 'needsMoreKey';
            });

            const context = createTestContext(editor, doc);
            const position = new Position(0, 0);
            assert.ok(ipTextObject, 'Should find ip text object');

            const result = ipTextObject(context, ['i', 'p'], position);

            assert.strictEqual(result.result, 'match');
            if (result.result === 'match') {
                const text = doc.getText(result.data.range);
                assert.strictEqual(text, '', 'Should return empty range for empty document');
            }
        });

        test('should handle document with only blank lines', async () => {
            const content = '\n\n\n';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            const textObjects = buildTextObjects([]);
            const ipTextObject = textObjects.find((to) => {
                const result = to(createTestContext(editor, doc), ['i', 'p'], new Position(0, 0));
                return result.result === 'match' || result.result === 'needsMoreKey';
            });

            const context = createTestContext(editor, doc);
            const position = new Position(1, 0);
            assert.ok(ipTextObject, 'Should find ip text object');

            const result = ipTextObject(context, ['i', 'p'], position);

            assert.strictEqual(result.result, 'match');
            if (result.result === 'match') {
                const text = doc.getText(result.data.range);
                assert.strictEqual(text, '\n', 'Should return just newline when on blank line');
            }
        });

        test('should handle single line document', async () => {
            const content = 'single line';
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            const textObjects = buildTextObjects([]);
            const ipTextObject = textObjects.find((to) => {
                const result = to(createTestContext(editor, doc), ['i', 'p'], new Position(0, 0));
                return result.result === 'match' || result.result === 'needsMoreKey';
            });

            const context = createTestContext(editor, doc);
            const position = new Position(0, 5);
            assert.ok(ipTextObject, 'Should find ip text object');

            const result = ipTextObject(context, ['i', 'p'], position);

            assert.strictEqual(result.result, 'match');
            if (result.result === 'match') {
                const text = doc.getText(result.data.range);
                assert.strictEqual(text, 'single line', 'Should select entire line');
            }
        });
    });
});
