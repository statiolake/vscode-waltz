import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { Position, Selection } from 'vscode';
import { motionToAction, newAction } from '../../action/actionBuilder';
import { newMotion } from '../../motion/motionBuilder';
import { buildMotions } from '../../motion/motions';
import type { Motion } from '../../motion/motionTypes';
import { createTestContext } from '../extension.test';

/**
 * 指定したキーシーケンスにマッチする motion を見つける
 */
async function findMotionByKeys(motions: Motion[], keys: string[]): Promise<Motion | undefined> {
    const dummyContext = createTestContext(undefined);
    const dummyPosition = new Position(0, 0);
    for (const motion of motions) {
        const result = await motion(dummyContext, keys, dummyPosition);
        if (result.result === 'match' || result.result === 'matchAsFallback') {
            return motion;
        }
    }
    return undefined;
}

suite('Fallback Tests', () => {
    suite('motionToAction fallback', () => {
        test('should execute fallback when editor is undefined', async () => {
            let fallbackCalled = false;

            const motion = newMotion({
                keys: ['j'],
                compute: (_context, position) => {
                    return new Position(position.line + 1, position.character);
                },
                fallback: async () => {
                    fallbackCalled = true;
                },
            });

            const action = motionToAction(motion);
            const context = createTestContext(undefined);
            context.vimState.mode = 'normal';

            const result = await action(context, ['j']);

            assert.strictEqual(result, 'executed');
            assert.strictEqual(fallbackCalled, true, 'Fallback should be called when editor is undefined');
        });

        test('should return noMatch when editor is undefined and no fallback', async () => {
            const motion = newMotion({
                keys: ['j'],
                compute: (_context, position) => {
                    return new Position(position.line + 1, position.character);
                },
                // no fallback
            });

            const action = motionToAction(motion);
            const context = createTestContext(undefined);
            context.vimState.mode = 'normal';

            const result = await action(context, ['j']);

            assert.strictEqual(result, 'noMatch');
        });

        test('should execute normal compute when editor is defined', async () => {
            let fallbackCalled = false;
            let computeCalled = false;

            const motion = newMotion({
                keys: ['j'],
                compute: (_context, position) => {
                    computeCalled = true;
                    return new Position(position.line + 1, position.character);
                },
                fallback: async () => {
                    fallbackCalled = true;
                },
            });

            const action = motionToAction(motion);

            // 実際のエディタを開く
            const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(0, 0), new Position(0, 0));

            const context = createTestContext(editor);
            context.vimState.mode = 'normal';

            const result = await action(context, ['j']);

            assert.strictEqual(result, 'executed');
            assert.strictEqual(computeCalled, true, 'Compute should be called when editor is defined');
            assert.strictEqual(fallbackCalled, false, 'Fallback should NOT be called when editor is defined');

            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });

        test('should respect needsMoreKey even with fallback', async () => {
            let fallbackCalled = false;

            const motion = newMotion({
                keys: ['g', 'g'],
                compute: (_context, _position) => {
                    return new Position(0, 0);
                },
                fallback: async () => {
                    fallbackCalled = true;
                },
            });

            const action = motionToAction(motion);
            const context = createTestContext(undefined);
            context.vimState.mode = 'normal';

            // 'g' だけ渡す
            const result = await action(context, ['g']);

            assert.strictEqual(result, 'needsMoreKey');
            assert.strictEqual(fallbackCalled, false, 'Fallback should NOT be called for partial match');
        });
    });

    suite('newAction fallback', () => {
        test('should execute fallback when editor is undefined', async () => {
            let fallbackCalled = false;
            let executeCalled = false;

            const action = newAction({
                keys: ['x'],
                modes: ['normal'],
                execute: async (_context) => {
                    executeCalled = true;
                },
                fallback: async () => {
                    fallbackCalled = true;
                },
            });

            const context = createTestContext(undefined);
            context.vimState.mode = 'normal';

            const result = await action(context, ['x']);

            assert.strictEqual(result, 'executed');
            assert.strictEqual(fallbackCalled, true, 'Fallback should be called when editor is undefined');
            assert.strictEqual(executeCalled, false, 'Execute should NOT be called when editor is undefined');
        });

        test('should return noMatch when editor is undefined and no fallback', async () => {
            let executeCalled = false;

            const action = newAction({
                keys: ['x'],
                modes: ['normal'],
                execute: async (_context) => {
                    executeCalled = true;
                },
                // no fallback
            });

            const context = createTestContext(undefined);
            context.vimState.mode = 'normal';

            const result = await action(context, ['x']);

            assert.strictEqual(result, 'noMatch');
            assert.strictEqual(executeCalled, false, 'Execute should NOT be called when editor is undefined');
        });

        test('should execute normal execute when editor is defined', async () => {
            let fallbackCalled = false;
            let executeCalled = false;

            const action = newAction({
                keys: ['x'],
                modes: ['normal'],
                execute: async (_context) => {
                    executeCalled = true;
                },
                fallback: async () => {
                    fallbackCalled = true;
                },
            });

            const doc = await vscode.workspace.openTextDocument({ content: 'test' });
            const editor = await vscode.window.showTextDocument(doc);

            const context = createTestContext(editor);
            context.vimState.mode = 'normal';

            const result = await action(context, ['x']);

            assert.strictEqual(result, 'executed');
            assert.strictEqual(executeCalled, true, 'Execute should be called when editor is defined');
            assert.strictEqual(fallbackCalled, false, 'Fallback should NOT be called when editor is defined');

            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });
    });

    suite('mode check with fallback', () => {
        test('should return noMatch for wrong mode even with fallback', async () => {
            let fallbackCalled = false;

            const motion = newMotion({
                keys: ['j'],
                compute: (_context, position) => {
                    return new Position(position.line + 1, position.character);
                },
                fallback: async () => {
                    fallbackCalled = true;
                },
            });

            const action = motionToAction(motion);
            const context = createTestContext(undefined);
            context.vimState.mode = 'insert'; // Wrong mode

            const result = await action(context, ['j']);

            assert.strictEqual(result, 'noMatch');
            assert.strictEqual(fallbackCalled, false, 'Fallback should NOT be called for wrong mode');
        });
    });

    suite('real motion fallback - selection changes', () => {
        // これらのテストは editor undefined の Context を渡すが、
        // fallback が vscode.commands.executeCommand を呼び出すので、
        // 実際のエディタの selection が変わることを確認する

        let editor: vscode.TextEditor;

        setup(async () => {
            const content = 'line 1\nline 2\nline 3\nline 4\nline 5';
            const doc = await vscode.workspace.openTextDocument({ content });
            editor = await vscode.window.showTextDocument(doc);
            editor.selection = new Selection(new Position(2, 3), new Position(2, 3)); // 3行目の4文字目
        });

        teardown(async () => {
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });

        test('j fallback should move cursor down', async () => {
            const motions = buildMotions();
            const jMotion = await findMotionByKeys(motions, ['j']);
            assert.ok(jMotion, 'j motion should exist');

            const action = motionToAction(jMotion);
            const context = createTestContext(undefined); // editor undefined
            context.vimState.mode = 'normal';

            const beforeLine = editor.selection.active.line;
            const result = await action(context, ['j']);

            assert.strictEqual(result, 'executed');
            assert.strictEqual(editor.selection.active.line, beforeLine + 1, 'Cursor should move down one line');
        });

        test('k fallback should move cursor up', async () => {
            const motions = buildMotions();
            const kMotion = await findMotionByKeys(motions, ['k']);
            assert.ok(kMotion, 'k motion should exist');

            const action = motionToAction(kMotion);
            const context = createTestContext(undefined);
            context.vimState.mode = 'normal';

            const beforeLine = editor.selection.active.line;
            const result = await action(context, ['k']);

            assert.strictEqual(result, 'executed');
            assert.strictEqual(editor.selection.active.line, beforeLine - 1, 'Cursor should move up one line');
        });

        test('h fallback should move cursor left', async () => {
            // Reset selection before test since findMotionByKeys may have moved cursor
            editor.selection = new Selection(new Position(2, 3), new Position(2, 3));

            const motions = buildMotions();
            const hMotion = await findMotionByKeys(motions, ['h']);
            assert.ok(hMotion, 'h motion should exist');

            // Reset selection again after findMotionByKeys
            editor.selection = new Selection(new Position(2, 3), new Position(2, 3));

            const action = motionToAction(hMotion);
            const context = createTestContext(undefined);
            context.vimState.mode = 'normal';

            const beforeChar = editor.selection.active.character;
            const result = await action(context, ['h']);

            assert.strictEqual(result, 'executed');
            assert.strictEqual(editor.selection.active.character, beforeChar - 1, 'Cursor should move left one char');
        });

        test('l fallback should move cursor right', async () => {
            // Reset selection before test since findMotionByKeys may have moved cursor
            editor.selection = new Selection(new Position(2, 3), new Position(2, 3));

            const motions = buildMotions();
            const lMotion = await findMotionByKeys(motions, ['l']);
            assert.ok(lMotion, 'l motion should exist');

            // Reset selection again after findMotionByKeys
            editor.selection = new Selection(new Position(2, 3), new Position(2, 3));

            const action = motionToAction(lMotion);
            const context = createTestContext(undefined);
            context.vimState.mode = 'normal';

            const beforeChar = editor.selection.active.character;
            const result = await action(context, ['l']);

            assert.strictEqual(result, 'executed');
            assert.strictEqual(editor.selection.active.character, beforeChar + 1, 'Cursor should move right one char');
        });

        test('gg fallback should move cursor to top', async () => {
            const motions = buildMotions();
            const ggMotion = await findMotionByKeys(motions, ['g', 'g']);
            assert.ok(ggMotion, 'gg motion should exist');

            const action = motionToAction(ggMotion);
            const context = createTestContext(undefined);
            context.vimState.mode = 'normal';

            const result = await action(context, ['g', 'g']);

            assert.strictEqual(result, 'executed');
            assert.strictEqual(editor.selection.active.line, 0, 'Cursor should be at top of document');
        });

        test('G fallback should move cursor to bottom', async () => {
            const motions = buildMotions();
            const GMotion = await findMotionByKeys(motions, ['G']);
            assert.ok(GMotion, 'G motion should exist');

            const action = motionToAction(GMotion);
            const context = createTestContext(undefined);
            context.vimState.mode = 'normal';

            const result = await action(context, ['G']);

            assert.strictEqual(result, 'executed');
            assert.strictEqual(
                editor.selection.active.line,
                editor.document.lineCount - 1,
                'Cursor should be at bottom of document',
            );
        });

        test('0 fallback should move cursor to line start', async () => {
            const motions = buildMotions();
            const zeroMotion = await findMotionByKeys(motions, ['0']);
            assert.ok(zeroMotion, '0 motion should exist');

            const action = motionToAction(zeroMotion);
            const context = createTestContext(undefined);
            context.vimState.mode = 'normal';

            const result = await action(context, ['0']);

            assert.strictEqual(result, 'executed');
            assert.strictEqual(editor.selection.active.character, 0, 'Cursor should be at start of line');
        });

        test('$ fallback should move cursor to line end', async () => {
            const motions = buildMotions();
            const dollarMotion = await findMotionByKeys(motions, ['$']);
            assert.ok(dollarMotion, '$ motion should exist');

            const action = motionToAction(dollarMotion);
            const context = createTestContext(undefined);
            context.vimState.mode = 'normal';

            const result = await action(context, ['$']);

            assert.strictEqual(result, 'executed');
            const lineLength = editor.document.lineAt(editor.selection.active.line).text.length;
            assert.strictEqual(editor.selection.active.character, lineLength, 'Cursor should be at end of line');
        });

        test('w fallback should move cursor to next word', async () => {
            // "line 3" の "l" にカーソルを置く
            editor.selection = new Selection(new Position(2, 0), new Position(2, 0));

            const motions = buildMotions();
            const wMotion = await findMotionByKeys(motions, ['w']);
            assert.ok(wMotion, 'w motion should exist');

            const action = motionToAction(wMotion);
            const context = createTestContext(undefined);
            context.vimState.mode = 'normal';

            const result = await action(context, ['w']);

            assert.strictEqual(result, 'executed');
            // "line" -> "3" へ移動するので character > 0
            assert.ok(editor.selection.active.character > 0, 'Cursor should move to next word');
        });

        test('b fallback should move cursor to previous word', async () => {
            // "line 3" の "3" にカーソルを置く
            editor.selection = new Selection(new Position(2, 5), new Position(2, 5));

            const motions = buildMotions();
            const bMotion = await findMotionByKeys(motions, ['b']);
            assert.ok(bMotion, 'b motion should exist');

            // Reset selection again after findMotionByKeys
            editor.selection = new Selection(new Position(2, 5), new Position(2, 5));

            const action = motionToAction(bMotion);
            const context = createTestContext(undefined);
            context.vimState.mode = 'normal';

            const result = await action(context, ['b']);

            assert.strictEqual(result, 'executed');
            // "3" -> "line" へ移動するので character < 5
            assert.ok(editor.selection.active.character < 5, 'Cursor should move to previous word');
        });
    });
});
