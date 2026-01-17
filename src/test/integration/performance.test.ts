import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { Position } from 'vscode';
import type { VimState } from '../../vimState';

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

async function executeWaltz(keys: string[]) {
    await vscode.commands.executeCommand('waltz.execute', { keys });
}

suite('Performance Integration Tests', () => {
    suite('keystroke latency', () => {
        test('single key motion (j) - repeated execution', async () => {
            // Create a document with many lines
            const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
            const doc = await vscode.workspace.openTextDocument({ content: lines.join('\n') });
            const editor = await vscode.window.showTextDocument(doc);

            // Start at top
            editor.selection = new vscode.Selection(new Position(0, 0), new Position(0, 0));

            const iterations = 50;
            const times: number[] = [];

            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                await executeWaltz(['j']);
                times.push(performance.now() - start);
            }

            const avg = times.reduce((a, b) => a + b, 0) / times.length;
            const max = Math.max(...times);
            const min = Math.min(...times);

            console.log(
                `[PERF] Motion 'j' x${iterations}: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms`,
            );
            assert.ok(avg < 50, `Average latency should be under 50ms, got ${avg.toFixed(2)}ms`);
        });

        test('operator + motion (dw) - repeated execution', async () => {
            // Create a document with many words
            const content = Array.from({ length: 20 }, () => 'word1 word2 word3 word4 word5').join('\n');
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            const iterations = 20;
            const times: number[] = [];

            for (let i = 0; i < iterations; i++) {
                // Reset position
                editor.selection = new vscode.Selection(new Position(i, 0), new Position(i, 0));

                const start = performance.now();
                await executeWaltz(['d', 'w']);
                times.push(performance.now() - start);
            }

            const avg = times.reduce((a, b) => a + b, 0) / times.length;
            const max = Math.max(...times);
            const min = Math.min(...times);

            console.log(
                `[PERF] Operator 'dw' x${iterations}: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms`,
            );
            assert.ok(avg < 100, `Average latency should be under 100ms, got ${avg.toFixed(2)}ms`);
        });

        test('mode switch (i -> Escape) - latency', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'test content' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new vscode.Selection(new Position(0, 0), new Position(0, 0));

            const iterations = 20;
            const enterInsertTimes: number[] = [];
            const exitInsertTimes: number[] = [];

            for (let i = 0; i < iterations; i++) {
                // Enter insert mode
                let start = performance.now();
                await executeWaltz(['i']);
                enterInsertTimes.push(performance.now() - start);

                // Exit insert mode
                start = performance.now();
                await vscode.commands.executeCommand('waltz.escapeKey');
                exitInsertTimes.push(performance.now() - start);
            }

            const avgEnter = enterInsertTimes.reduce((a, b) => a + b, 0) / enterInsertTimes.length;
            const avgExit = exitInsertTimes.reduce((a, b) => a + b, 0) / exitInsertTimes.length;

            console.log(`[PERF] Enter insert 'i' x${iterations}: avg=${avgEnter.toFixed(2)}ms`);
            console.log(`[PERF] Exit insert (Escape) x${iterations}: avg=${avgExit.toFixed(2)}ms`);

            assert.ok(avgEnter < 50, `Enter insert should be under 50ms, got ${avgEnter.toFixed(2)}ms`);
            assert.ok(avgExit < 50, `Exit insert should be under 50ms, got ${avgExit.toFixed(2)}ms`);
        });

        test('text object (diw) - latency', async () => {
            const content = Array.from({ length: 20 }, () => 'hello world foo bar').join('\n');
            const doc = await vscode.workspace.openTextDocument({ content });
            const editor = await vscode.window.showTextDocument(doc);

            const iterations = 20;
            const times: number[] = [];

            for (let i = 0; i < iterations; i++) {
                // Position in middle of a word
                editor.selection = new vscode.Selection(new Position(i, 2), new Position(i, 2));

                const start = performance.now();
                await executeWaltz(['d', 'i', 'w']);
                times.push(performance.now() - start);
            }

            const avg = times.reduce((a, b) => a + b, 0) / times.length;
            const max = Math.max(...times);

            console.log(`[PERF] Text object 'diw' x${iterations}: avg=${avg.toFixed(2)}ms, max=${max.toFixed(2)}ms`);
            assert.ok(avg < 100, `Average latency should be under 100ms, got ${avg.toFixed(2)}ms`);
        });

        test('action loop - worst case (no match)', async () => {
            const doc = await vscode.workspace.openTextDocument({ content: 'test' });
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new vscode.Selection(new Position(0, 0), new Position(0, 0));

            const vimState = await getVimState();

            // Simulate worst case: key that doesn't match any action
            // This will go through ALL actions before giving up
            const iterations = 20;
            const times: number[] = [];

            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                // Use a key combination that won't match anything
                await executeWaltz(['z', 'z', 'z']);
                times.push(performance.now() - start);
            }

            const avg = times.reduce((a, b) => a + b, 0) / times.length;
            console.log(
                `[PERF] No-match worst case x${iterations}: avg=${avg.toFixed(2)}ms (iterates all ${vimState.actions.length} actions)`,
            );
        });
    });
});
