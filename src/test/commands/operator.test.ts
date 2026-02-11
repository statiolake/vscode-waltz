/**
 * Unit tests for text object range calculation logic
 * These tests directly test the range calculation functions without executing commands
 */

import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { Position } from 'vscode';
import {
    findPairRange,
    findQuoteRange,
    getAroundBigWordRange,
    getAroundDoubleQuoteRange,
    getAroundParenRange,
    getAroundWordRange,
    getCharLeftRange,
    getCharRightRange,
    getInnerAngleRange,
    getInnerBacktickRange,
    getInnerBigWordRange,
    getInnerBraceRange,
    getInnerBracketRange,
    getInnerDoubleQuoteRange,
    getInnerParenRange,
    getInnerSingleQuoteRange,
    getInnerWordRange,
    getLineDownRange,
    getLineEndRange,
    getLineFirstNonWhitespaceRange,
    getLineStartRange,
    getLineUpRange,
    getWordBackwardRange,
    getWordEndRange,
    getWordForwardRange,
} from '../../commands/textObject';

suite('Text Object Range Calculation Tests', () => {
    // Helper to create a real VS Code document
    async function createDocument(content: string): Promise<vscode.TextDocument> {
        const doc = await vscode.workspace.openTextDocument({
            content,
            language: 'plaintext',
        });
        return doc;
    }

    suite('findQuoteRange', () => {
        suite('double quotes', () => {
            test('cursor after opening quote should find full range', async () => {
                const doc = await createDocument('"Hello, world!"');
                const range = findQuoteRange(doc, new Position(0, 1), '"', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.line, 0, 'Start line should be 0');
                assert.strictEqual(range.start.character, 1, 'Start character should be 1 (after opening quote)');
                assert.strictEqual(range.end.line, 0, 'End line should be 0');
                assert.strictEqual(range.end.character, 14, 'End character should be 14 (before closing quote)');
            });

            test('cursor before closing quote should find full range', async () => {
                const doc = await createDocument('"Hello, world!"');
                const range = findQuoteRange(doc, new Position(0, 14), '"', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start character should be 1');
                assert.strictEqual(range.end.character, 14, 'End character should be 14');
            });

            test('cursor in middle should find full range', async () => {
                const doc = await createDocument('"Hello, world!"');
                const range = findQuoteRange(doc, new Position(0, 7), '"', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start character should be 1');
                assert.strictEqual(range.end.character, 14, 'End character should be 14');
            });

            test('inner=true should exclude quotes', async () => {
                const doc = await createDocument('"Hello, world!"');
                const range = findQuoteRange(doc, new Position(0, 5), '"', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Should start after opening quote');
                assert.strictEqual(range.end.character, 14, 'Should end before closing quote');
            });

            test('inner=false should include quotes', async () => {
                const doc = await createDocument('"Hello, world!"');
                const range = findQuoteRange(doc, new Position(0, 5), '"', false);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0, 'Should start at opening quote');
                assert.strictEqual(range.end.character, 15, 'Should end after closing quote');
            });

            test('empty string "" should return empty range', async () => {
                const doc = await createDocument('""');
                const range = findQuoteRange(doc, new Position(0, 1), '"', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start should be after opening quote');
                assert.strictEqual(range.end.character, 1, 'End should be before closing quote (empty range)');
            });

            test('multiple quoted strings should find the one containing cursor', async () => {
                const doc = await createDocument('"foo" and "bar"');
                const range1 = findQuoteRange(doc, new Position(0, 2), '"', true);
                assert.ok(range1, 'Should find first range');
                assert.strictEqual(range1.start.character, 1, 'First range start');
                assert.strictEqual(range1.end.character, 4, 'First range end');

                const range2 = findQuoteRange(doc, new Position(0, 12), '"', true);
                assert.ok(range2, 'Should find second range');
                assert.strictEqual(range2.start.character, 11, 'Second range start');
                assert.strictEqual(range2.end.character, 14, 'Second range end');
            });

            test('multiple quoted strings with inner=false should include quotes', async () => {
                const doc = await createDocument('"hello" "world"');
                // Cursor at position 3 (inside "hello")
                const range1 = findQuoteRange(doc, new Position(0, 3), '"', false);
                assert.ok(range1, 'Should find first range');
                assert.strictEqual(range1.start.character, 0, 'First range start (include opening quote)');
                assert.strictEqual(range1.end.character, 7, 'First range end (include closing quote)');

                // Cursor at position 11 (inside "world")
                const range2 = findQuoteRange(doc, new Position(0, 11), '"', false);
                assert.ok(range2, 'Should find second range');
                assert.strictEqual(range2.start.character, 8, 'Second range start (include opening quote)');
                assert.strictEqual(range2.end.character, 15, 'Second range end (include closing quote)');
            });

            test('cursor before first quote should find first quote', async () => {
                const doc = await createDocument('"Hello"');
                const range = findQuoteRange(doc, new Position(0, 0), '"', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Should find first quote');
            });
        });

        suite('single quotes', () => {
            test('inner single quotes', async () => {
                const doc = await createDocument("'Hello, world!'");
                const range = findQuoteRange(doc, new Position(0, 5), "'", true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start after opening quote');
                assert.strictEqual(range.end.character, 14, 'End before closing quote');
            });

            test('outer single quotes', async () => {
                const doc = await createDocument("'Hello'");
                const range = findQuoteRange(doc, new Position(0, 3), "'", false);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0, 'Start at opening quote');
                assert.strictEqual(range.end.character, 7, 'End after closing quote');
            });
        });

        suite('backticks', () => {
            test('inner backticks', async () => {
                const doc = await createDocument('`code`');
                const range = findQuoteRange(doc, new Position(0, 3), '`', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start after opening backtick');
                assert.strictEqual(range.end.character, 5, 'End before closing backtick');
            });
        });
    });

    suite('findPairRange', () => {
        suite('parentheses', () => {
            test('inner parentheses', async () => {
                const doc = await createDocument('(Hello, world!)');
                const range = findPairRange(doc, new Position(0, 5), '(', ')', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start after opening paren');
                assert.strictEqual(range.end.character, 14, 'End before closing paren');
            });

            test('outer parentheses', async () => {
                const doc = await createDocument('(Hello, world!)');
                const range = findPairRange(doc, new Position(0, 5), '(', ')', false);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0, 'Start at opening paren');
                assert.strictEqual(range.end.character, 15, 'End after closing paren');
            });

            test('nested parentheses should find innermost', async () => {
                const doc = await createDocument('((nested))');
                const range = findPairRange(doc, new Position(0, 5), '(', ')', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 2, 'Start at inner opening paren');
                assert.strictEqual(range.end.character, 8, 'End at inner closing paren');
            });

            test('empty parentheses', async () => {
                const doc = await createDocument('()');
                const range = findPairRange(doc, new Position(0, 1), '(', ')', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start after opening paren');
                assert.strictEqual(range.end.character, 1, 'End before closing paren (empty)');
            });
        });

        suite('braces', () => {
            test('inner braces', async () => {
                const doc = await createDocument('{Hello, world!}');
                const range = findPairRange(doc, new Position(0, 5), '{', '}', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start after opening brace');
                assert.strictEqual(range.end.character, 14, 'End before closing brace');
            });

            test('nested braces should find innermost', async () => {
                const doc = await createDocument('{{nested}}');
                const range = findPairRange(doc, new Position(0, 5), '{', '}', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 2, 'Start at inner opening brace');
                assert.strictEqual(range.end.character, 8, 'End at inner closing brace');
            });
        });

        suite('brackets', () => {
            test('inner brackets', async () => {
                const doc = await createDocument('[Hello, world!]');
                const range = findPairRange(doc, new Position(0, 5), '[', ']', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start after opening bracket');
                assert.strictEqual(range.end.character, 14, 'End before closing bracket');
            });
        });

        suite('multi-line pairs', () => {
            test('parentheses across multiple lines', async () => {
                const doc = await createDocument('(\nline1\nline2\n)');
                const range = findPairRange(doc, new Position(1, 3), '(', ')', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.line, 0, 'Start line should be 0');
                assert.strictEqual(range.start.character, 1, 'Start after opening paren');
                assert.strictEqual(range.end.line, 3, 'End line should be 3');
                assert.strictEqual(range.end.character, 0, 'End before closing paren');
            });
        });
    });

    suite('getTextObjectRange - word text objects', () => {
        suite('iw (inner word)', () => {
            test('cursor in middle of word', async () => {
                const doc = await createDocument('hello world');
                const range = getInnerWordRange(doc, new Position(0, 2));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0, 'Should start at word start');
                assert.strictEqual(range.end.character, 5, 'Should end at word end');
            });

            test('cursor at start of word', async () => {
                const doc = await createDocument('hello world');
                const range = getInnerWordRange(doc, new Position(0, 0));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0);
                assert.strictEqual(range.end.character, 5);
            });

            test('cursor at end of word', async () => {
                const doc = await createDocument('hello world');
                const range = getInnerWordRange(doc, new Position(0, 4));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0);
                assert.strictEqual(range.end.character, 5);
            });

            test('cursor on second word', async () => {
                const doc = await createDocument('hello world');
                const range = getInnerWordRange(doc, new Position(0, 7));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 6, 'Should start at second word');
                assert.strictEqual(range.end.character, 11, 'Should end at second word end');
            });
        });

        suite('aw (around word)', () => {
            test('should include trailing whitespace', async () => {
                const doc = await createDocument('hello world');
                const range = getAroundWordRange(doc, new Position(0, 2));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0, 'Should start at word start');
                assert.strictEqual(range.end.character, 6, 'Should include trailing space');
            });
        });

        suite('iW (inner WORD)', () => {
            test('whitespace-delimited WORD', async () => {
                const doc = await createDocument('hello_world foo');
                const range = getInnerBigWordRange(doc, new Position(0, 5));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0, 'Should start at WORD start');
                assert.strictEqual(range.end.character, 11, 'Should end at WORD end');
            });

            test('cursor in middle of WORD', async () => {
                const doc = await createDocument('foo-bar+baz');
                const range = getInnerBigWordRange(doc, new Position(0, 4));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0);
                assert.strictEqual(range.end.character, 11);
            });
        });

        suite('aW (around WORD)', () => {
            test('should include trailing whitespace', async () => {
                const doc = await createDocument('foo-bar baz');
                const range = getAroundBigWordRange(doc, new Position(0, 3));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0);
                assert.strictEqual(range.end.character, 8, 'Should include trailing space');
            });
        });
    });

    suite('getTextObjectRange - quote text objects', () => {
        test('i" should call findQuoteRange with inner=true', async () => {
            const doc = await createDocument('"Hello"');
            const range = getInnerDoubleQuoteRange(doc, new Position(0, 3));
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1, 'Should start after opening quote');
            assert.strictEqual(range.end.character, 6, 'Should end before closing quote');
        });

        test('a" should call findQuoteRange with inner=false', async () => {
            const doc = await createDocument('"Hello"');
            const range = getAroundDoubleQuoteRange(doc, new Position(0, 3));
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 0, 'Should start at opening quote');
            assert.strictEqual(range.end.character, 7, 'Should end after closing quote');
        });

        test("i' should work with single quotes", async () => {
            const doc = await createDocument("'Hello'");
            const range = getInnerSingleQuoteRange(doc, new Position(0, 3));
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('i` should work with backticks', async () => {
            const doc = await createDocument('`Hello`');
            const range = getInnerBacktickRange(doc, new Position(0, 3));
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });
    });

    suite('getTextObjectRange - pair text objects', () => {
        test('i( should find inner parentheses', async () => {
            const doc = await createDocument('(Hello)');
            const range = getInnerParenRange(doc, new Position(0, 3));
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('ib should find inner parentheses (b for block)', async () => {
            const doc = await createDocument('(Hello)');
            const range = getInnerParenRange(doc, new Position(0, 3));
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('i) should find inner parentheses', async () => {
            const doc = await createDocument('(Hello)');
            const range = getInnerParenRange(doc, new Position(0, 3));
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('a( should find outer parentheses', async () => {
            const doc = await createDocument('(Hello)');
            const range = getAroundParenRange(doc, new Position(0, 3));
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 0);
            assert.strictEqual(range.end.character, 7);
        });

        test('i{ should find inner braces', async () => {
            const doc = await createDocument('{Hello}');
            const range = getInnerBraceRange(doc, new Position(0, 3));
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('iB should find inner braces (B for block)', async () => {
            const doc = await createDocument('{Hello}');
            const range = getInnerBraceRange(doc, new Position(0, 3));
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('i} should find inner braces', async () => {
            const doc = await createDocument('{Hello}');
            const range = getInnerBraceRange(doc, new Position(0, 3));
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('i[ should find inner brackets', async () => {
            const doc = await createDocument('[Hello]');
            const range = getInnerBracketRange(doc, new Position(0, 3));
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('i] should find inner brackets', async () => {
            const doc = await createDocument('[Hello]');
            const range = getInnerBracketRange(doc, new Position(0, 3));
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('i< should find inner angle brackets', async () => {
            const doc = await createDocument('<Hello>');
            const range = getInnerAngleRange(doc, new Position(0, 3));
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('i> should find inner angle brackets', async () => {
            const doc = await createDocument('<Hello>');
            const range = getInnerAngleRange(doc, new Position(0, 3));
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });
    });

    suite('getTextObjectRange - motion text objects', () => {
        suite('w (forward to end of word)', () => {
            test('should move from cursor to end of word', async () => {
                const doc = await createDocument('hello world');
                const range = getWordForwardRange(doc, new Position(0, 2));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 2, 'Should start at cursor');
                assert.strictEqual(range.end.character, 5, 'Should end at word end');
            });
        });

        suite('b (backward to start of word)', () => {
            test('should move from cursor to start of word', async () => {
                const doc = await createDocument('hello world');
                const range = getWordBackwardRange(doc, new Position(0, 3));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0, 'Should start at word start');
                assert.strictEqual(range.end.character, 3, 'Should end at cursor');
            });
        });

        suite('e (forward to end of word)', () => {
            test('should move from cursor to end of word', async () => {
                const doc = await createDocument('hello world');
                const range = getWordEndRange(doc, new Position(0, 2));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 2, 'Should start at cursor');
                assert.strictEqual(range.end.character, 5, 'Should end at word end');
            });
        });

        suite('$ (to end of line)', () => {
            test('should move from cursor to end of line', async () => {
                const doc = await createDocument('hello world');
                const range = getLineEndRange(doc, new Position(0, 5));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 5, 'Should start at cursor');
                assert.strictEqual(range.end.character, 11, 'Should end at line end');
            });
        });

        suite('0 (to start of line)', () => {
            test('should move from cursor to start of line', async () => {
                const doc = await createDocument('hello world');
                const range = getLineStartRange(doc, new Position(0, 7));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0, 'Should start at line start');
                assert.strictEqual(range.end.character, 7, 'Should end at cursor');
            });
        });

        suite('^ (to first non-whitespace)', () => {
            test('should move to first non-whitespace character', async () => {
                const doc = await createDocument('  hello world');
                const range = getLineFirstNonWhitespaceRange(doc, new Position(0, 7));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 2, 'Should start at first non-whitespace');
                assert.strictEqual(range.end.character, 7, 'Should end at cursor');
            });
        });

        suite('h (left)', () => {
            test('should move one character left', async () => {
                const doc = await createDocument('hello');
                const range = getCharLeftRange(doc, new Position(0, 3));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 2, 'Should start one left');
                assert.strictEqual(range.end.character, 3, 'Should end at cursor');
            });

            test('at start of line should return null', async () => {
                const doc = await createDocument('hello');
                const range = getCharLeftRange(doc, new Position(0, 0));
                assert.strictEqual(range, null, 'Should return null at line start');
            });
        });

        suite('l (right)', () => {
            test('should move one character right', async () => {
                const doc = await createDocument('hello');
                const range = getCharRightRange(doc, new Position(0, 2));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 2, 'Should start at cursor');
                assert.strictEqual(range.end.character, 3, 'Should end one right');
            });

            test('at end of line should return null', async () => {
                const doc = await createDocument('hello');
                const range = getCharRightRange(doc, new Position(0, 5));
                assert.strictEqual(range, null, 'Should return null at line end');
            });
        });

        suite('j (down)', () => {
            test('should select current and next line', async () => {
                const doc = await createDocument('line1\nline2');
                const range = getLineDownRange(doc, new Position(0, 3));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.line, 0, 'Should start at current line');
                assert.strictEqual(range.end.line, 1, 'Should end at next line');
            });
        });

        suite('k (up)', () => {
            test('should select previous and current line', async () => {
                const doc = await createDocument('line1\nline2');
                const range = getLineUpRange(doc, new Position(1, 3));
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.line, 0, 'Should start at previous line');
                assert.strictEqual(range.end.line, 1, 'Should end at current line');
            });
        });
    });
});
