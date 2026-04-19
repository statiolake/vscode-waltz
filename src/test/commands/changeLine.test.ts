/**
 * S (cc / change line) parity tests
 *
 * executeChangeLineViaEdit (editor.edit 版) と executeChangeLineNative (native コマンド
 * シーケンス版) が非ゼロ幅ケースで同じ最終状態を生成することを保証する。空行 (ゼロ幅)
 * ケースについては意図的に差分があるため、差分を明示的に assert する。
 */

import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { Selection } from 'vscode';
import { executeChangeLineNative, executeChangeLineViaEdit } from '../../commands/operator';
import { createVimState } from '../../contextInitializers';

type CapturedState = {
    text: string;
    selections: { anchor: [number, number]; active: [number, number] }[];
};

const WAIT_MS = 30;
const wait = (ms = WAIT_MS) => new Promise((resolve) => setTimeout(resolve, ms));

function captureState(editor: vscode.TextEditor): CapturedState {
    return {
        text: editor.document.getText(),
        selections: editor.selections.map((s) => ({
            anchor: [s.anchor.line, s.anchor.character],
            active: [s.active.line, s.active.character],
        })),
    };
}

async function openEditor(content: string, language = 'plaintext'): Promise<vscode.TextEditor> {
    const doc = await vscode.workspace.openTextDocument({ content, language });
    const editor = await vscode.window.showTextDocument(doc);
    await wait();
    return editor;
}

async function setSelections(editor: vscode.TextEditor, selections: Selection[]): Promise<void> {
    editor.selections = selections;
    await wait();
}

async function runBoth(
    content: string,
    selections: Selection[],
    language = 'plaintext',
): Promise<{ native: CapturedState; edit: CapturedState }> {
    // Native path
    const editorA = await openEditor(content, language);
    await setSelections(editorA, selections);
    await executeChangeLineNative(createVimState());
    await wait();
    const native = captureState(editorA);

    // Editor.edit path
    const editorB = await openEditor(content, language);
    await setSelections(editorB, selections);
    await executeChangeLineViaEdit(createVimState(), editorB);
    await wait();
    const edit = captureState(editorB);

    return { native, edit };
}

suite('S (cc): executeChangeLineViaEdit vs executeChangeLineNative parity', () => {
    test('single cursor on content line (middle of document)', async () => {
        const content = 'line1\nline2\nline3';
        const { native, edit } = await runBoth(content, [new Selection(1, 2, 1, 2)]);
        assert.deepStrictEqual(edit, native);
    });

    test('single cursor on first line', async () => {
        const content = 'line1\nline2\nline3';
        const { native, edit } = await runBoth(content, [new Selection(0, 2, 0, 2)]);
        assert.deepStrictEqual(edit, native);
    });

    test('single cursor on last line', async () => {
        const content = 'line1\nline2\nline3';
        const { native, edit } = await runBoth(content, [new Selection(2, 2, 2, 2)]);
        assert.deepStrictEqual(edit, native);
    });

    test('single cursor on single-line document', async () => {
        const content = 'only one line';
        const { native, edit } = await runBoth(content, [new Selection(0, 4, 0, 4)]);
        assert.deepStrictEqual(edit, native);
    });

    test('multi-cursor on different content lines', async () => {
        const content = 'line1\nline2\nline3\nline4';
        const selections = [new Selection(0, 2, 0, 2), new Selection(1, 2, 1, 2), new Selection(3, 2, 3, 2)];
        const { native, edit } = await runBoth(content, selections);
        assert.deepStrictEqual(edit, native);
    });

    test('multi-cursor spanning first and last lines', async () => {
        const content = 'first\nmiddle\nlast';
        const selections = [new Selection(0, 2, 0, 2), new Selection(2, 2, 2, 2)];
        const { native, edit } = await runBoth(content, selections);
        assert.deepStrictEqual(edit, native);
    });

    test('cursor with non-zero column on indented line', async () => {
        const content = '    foo bar\n    baz qux';
        const { native, edit } = await runBoth(content, [new Selection(0, 7, 0, 7)]);
        assert.deepStrictEqual(edit, native);
    });
});

suite('S (cc): editor.edit path intentional divergences from native', () => {
    test('empty line: editor path preserves line, native path eats it', async () => {
        const content = 'foo\n\nbar';

        // Run native — empty line (line 1) gets cut entirely via emptySelectionClipboard
        const editorA = await openEditor(content);
        await setSelections(editorA, [new Selection(1, 0, 1, 0)]);
        await executeChangeLineNative(createVimState());
        await wait();
        const nativeText = editorA.document.getText();

        // Run editor.edit — empty line preserved
        const editorB = await openEditor(content);
        await setSelections(editorB, [new Selection(1, 0, 1, 0)]);
        await executeChangeLineViaEdit(createVimState(), editorB);
        await wait();
        const editText = editorB.document.getText();

        assert.strictEqual(editText, content, 'editor path leaves the empty line intact');
        assert.notStrictEqual(nativeText, editText, 'native path differs from editor on empty line (known divergence)');
    });

    test('empty-only multi-cursor: editor path does not touch clipboard', async () => {
        // 全カーソルが空行上にある場合は clipboard を汚染しない
        const content = 'foo\n\n\nbar';
        const editor = await openEditor(content);
        await setSelections(editor, [new Selection(1, 0, 1, 0), new Selection(2, 0, 2, 0)]);

        const before = await vscode.env.clipboard.readText();
        await executeChangeLineViaEdit(createVimState(), editor);
        await wait();
        const after = await vscode.env.clipboard.readText();

        assert.strictEqual(after, before, 'clipboard should not be touched when all target lines are empty');
    });
});
