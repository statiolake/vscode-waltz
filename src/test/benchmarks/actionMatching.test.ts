import * as assert from 'node:assert';
import { buildActions } from '../../action/actions';
import { keysParserPrefix, keysParserRegex } from '../../utils/keysParser/keysParser';

suite('Performance Benchmarks', () => {
    suite('keysParser', () => {
        test('keysParserPrefix - single key match', () => {
            const parser = keysParserPrefix(['j']);
            const iterations = 100000;

            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                parser(['j']);
            }
            const duration = performance.now() - start;

            console.log(
                `[BENCH] keysParserPrefix single key: ${(duration / iterations).toFixed(4)}ms per call, ${iterations} iterations in ${duration.toFixed(2)}ms`,
            );
            assert.ok(duration < 1000, 'Should complete 100k iterations in under 1 second');
        });

        test('keysParserPrefix - multi key match (dd)', () => {
            const parser = keysParserPrefix(['d', 'd']);
            const iterations = 100000;

            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                parser(['d', 'd']);
            }
            const duration = performance.now() - start;

            console.log(
                `[BENCH] keysParserPrefix multi key (dd): ${(duration / iterations).toFixed(4)}ms per call, ${iterations} iterations in ${duration.toFixed(2)}ms`,
            );
            assert.ok(duration < 1000, 'Should complete 100k iterations in under 1 second');
        });

        test('keysParserPrefix - needsMoreKey', () => {
            const parser = keysParserPrefix(['d', 'd']);
            const iterations = 100000;

            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                parser(['d']);
            }
            const duration = performance.now() - start;

            console.log(
                `[BENCH] keysParserPrefix needsMoreKey: ${(duration / iterations).toFixed(4)}ms per call, ${iterations} iterations in ${duration.toFixed(2)}ms`,
            );
            assert.ok(duration < 1000, 'Should complete 100k iterations in under 1 second');
        });

        test('keysParserPrefix - noMatch', () => {
            const parser = keysParserPrefix(['d', 'd']);
            const iterations = 100000;

            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                parser(['x']);
            }
            const duration = performance.now() - start;

            console.log(
                `[BENCH] keysParserPrefix noMatch: ${(duration / iterations).toFixed(4)}ms per call, ${iterations} iterations in ${duration.toFixed(2)}ms`,
            );
            assert.ok(duration < 1000, 'Should complete 100k iterations in under 1 second');
        });

        test('keysParserRegex - match (f + char)', () => {
            const parser = keysParserRegex(/^f(?<char>.)$/, /^f$/);
            const iterations = 100000;

            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                parser(['f', 'a']);
            }
            const duration = performance.now() - start;

            console.log(
                `[BENCH] keysParserRegex match: ${(duration / iterations).toFixed(4)}ms per call, ${iterations} iterations in ${duration.toFixed(2)}ms`,
            );
            assert.ok(duration < 2000, 'Should complete 100k iterations in under 2 seconds');
        });

        test('keysParserRegex - needsMoreKey', () => {
            const parser = keysParserRegex(/^f(?<char>.)$/, /^f$/);
            const iterations = 100000;

            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                parser(['f']);
            }
            const duration = performance.now() - start;

            console.log(
                `[BENCH] keysParserRegex needsMoreKey: ${(duration / iterations).toFixed(4)}ms per call, ${iterations} iterations in ${duration.toFixed(2)}ms`,
            );
            assert.ok(duration < 2000, 'Should complete 100k iterations in under 2 seconds');
        });

        test('keysParserRegex - noMatch', () => {
            const parser = keysParserRegex(/^f(?<char>.)$/, /^f$/);
            const iterations = 100000;

            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                parser(['x']);
            }
            const duration = performance.now() - start;

            console.log(
                `[BENCH] keysParserRegex noMatch: ${(duration / iterations).toFixed(4)}ms per call, ${iterations} iterations in ${duration.toFixed(2)}ms`,
            );
            assert.ok(duration < 2000, 'Should complete 100k iterations in under 2 seconds');
        });
    });

    suite('buildActions', () => {
        test('buildActions - initialization time', () => {
            const iterations = 100;

            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                buildActions();
            }
            const duration = performance.now() - start;

            console.log(
                `[BENCH] buildActions: ${(duration / iterations).toFixed(2)}ms per call, ${iterations} iterations in ${duration.toFixed(2)}ms`,
            );
            assert.ok(duration / iterations < 50, 'buildActions should complete in under 50ms');
        });

        test('buildActions - action count', () => {
            const actions = buildActions();
            console.log(`[INFO] Total actions built: ${actions.length}`);
            assert.ok(actions.length > 100, 'Should have more than 100 actions');
        });
    });
});
