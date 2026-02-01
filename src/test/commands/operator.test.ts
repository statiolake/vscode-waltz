/**
 * Unit tests for text object range calculation logic
 * These tests directly test the range calculation functions without executing commands
 */

import * as assert from 'node:assert';
import type * as vscode from 'vscode';
import { Position, Range } from 'vscode';
import { findPairRange, findQuoteRange, getTextObjectRange } from '../../commands/operator';

suite('Text Object Range Calculation Tests', () => {
    // Helper to create a mock document
    function createDocument(content: string): vscode.TextDocument {
        return {
            getText: () => content,
            lineAt: (line: number) => {
                const lines = content.split('\n');
                const lineText = lines[line] ?? '';
                return {
                    text: lineText,
                    range: new Range(new Position(line, 0), new Position(line, lineText.length)),
                    rangeIncludingLineBreak: new Range(new Position(line, 0), new Position(line, lineText.length + 1)),
                    firstNonWhitespaceCharacterIndex: lineText.search(/\S/),
                };
            },
            getWordRangeAtPosition: (position: Position) => {
                const lines = content.split('\n');
                const lineText = lines[position.line] ?? '';
                const wordRegex = /[\w]+/g;
                let match: RegExpExecArray | null;
                // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex exec pattern
                while ((match = wordRegex.exec(lineText)) !== null) {
                    if (match.index <= position.character && match.index + match[0].length >= position.character) {
                        return new Range(
                            new Position(position.line, match.index),
                            new Position(position.line, match.index + match[0].length),
                        );
                    }
                }
                return undefined;
            },
            offsetAt: (position: Position) => {
                const lines = content.split('\n');
                let offset = 0;
                for (let i = 0; i < position.line; i++) {
                    offset += lines[i].length + 1; // +1 for newline
                }
                return offset + position.character;
            },
            positionAt: (offset: number) => {
                const lines = content.split('\n');
                let currentOffset = 0;
                for (let i = 0; i < lines.length; i++) {
                    if (currentOffset + lines[i].length >= offset) {
                        return new Position(i, offset - currentOffset);
                    }
                    currentOffset += lines[i].length + 1;
                }
                return new Position(lines.length - 1, lines[lines.length - 1].length);
            },
        } as unknown as vscode.TextDocument;
    }

    suite('findQuoteRange', () => {
        suite('double quotes', () => {
            test('cursor after opening quote should find full range', () => {
                const doc = createDocument('"Hello, world!"');
                const range = findQuoteRange(doc, new Position(0, 1), '"', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.line, 0, 'Start line should be 0');
                assert.strictEqual(range.start.character, 1, 'Start character should be 1 (after opening quote)');
                assert.strictEqual(range.end.line, 0, 'End line should be 0');
                assert.strictEqual(range.end.character, 14, 'End character should be 14 (before closing quote)');
            });

            test('cursor before closing quote should find full range', () => {
                const doc = createDocument('"Hello, world!"');
                const range = findQuoteRange(doc, new Position(0, 14), '"', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start character should be 1');
                assert.strictEqual(range.end.character, 14, 'End character should be 14');
            });

            test('cursor in middle should find full range', () => {
                const doc = createDocument('"Hello, world!"');
                const range = findQuoteRange(doc, new Position(0, 7), '"', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start character should be 1');
                assert.strictEqual(range.end.character, 14, 'End character should be 14');
            });

            test('inner=true should exclude quotes', () => {
                const doc = createDocument('"Hello, world!"');
                const range = findQuoteRange(doc, new Position(0, 5), '"', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Should start after opening quote');
                assert.strictEqual(range.end.character, 14, 'Should end before closing quote');
            });

            test('inner=false should include quotes', () => {
                const doc = createDocument('"Hello, world!"');
                const range = findQuoteRange(doc, new Position(0, 5), '"', false);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0, 'Should start at opening quote');
                assert.strictEqual(range.end.character, 15, 'Should end after closing quote');
            });

            test('empty string "" should return empty range', () => {
                const doc = createDocument('""');
                const range = findQuoteRange(doc, new Position(0, 1), '"', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start should be after opening quote');
                assert.strictEqual(range.end.character, 1, 'End should be before closing quote (empty range)');
            });

            test('multiple quoted strings should find the one containing cursor', () => {
                const doc = createDocument('"foo" and "bar"');
                const range1 = findQuoteRange(doc, new Position(0, 2), '"', true);
                assert.ok(range1, 'Should find first range');
                assert.strictEqual(range1.start.character, 1, 'First range start');
                assert.strictEqual(range1.end.character, 4, 'First range end');

                const range2 = findQuoteRange(doc, new Position(0, 12), '"', true);
                assert.ok(range2, 'Should find second range');
                assert.strictEqual(range2.start.character, 11, 'Second range start');
                assert.strictEqual(range2.end.character, 14, 'Second range end');
            });

            test('cursor before first quote should find first quote', () => {
                const doc = createDocument('"Hello"');
                const range = findQuoteRange(doc, new Position(0, 0), '"', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Should find first quote');
            });
        });

        suite('single quotes', () => {
            test('inner single quotes', () => {
                const doc = createDocument("'Hello, world!'");
                const range = findQuoteRange(doc, new Position(0, 5), "'", true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start after opening quote');
                assert.strictEqual(range.end.character, 14, 'End before closing quote');
            });

            test('outer single quotes', () => {
                const doc = createDocument("'Hello'");
                const range = findQuoteRange(doc, new Position(0, 3), "'", false);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0, 'Start at opening quote');
                assert.strictEqual(range.end.character, 7, 'End after closing quote');
            });
        });

        suite('backticks', () => {
            test('inner backticks', () => {
                const doc = createDocument('`code`');
                const range = findQuoteRange(doc, new Position(0, 3), '`', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start after opening backtick');
                assert.strictEqual(range.end.character, 5, 'End before closing backtick');
            });
        });
    });

    suite('findPairRange', () => {
        suite('parentheses', () => {
            test('inner parentheses', () => {
                const doc = createDocument('(Hello, world!)');
                const range = findPairRange(doc, new Position(0, 5), '(', ')', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start after opening paren');
                assert.strictEqual(range.end.character, 14, 'End before closing paren');
            });

            test('outer parentheses', () => {
                const doc = createDocument('(Hello, world!)');
                const range = findPairRange(doc, new Position(0, 5), '(', ')', false);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0, 'Start at opening paren');
                assert.strictEqual(range.end.character, 15, 'End after closing paren');
            });

            test('nested parentheses should find innermost', () => {
                const doc = createDocument('((nested))');
                const range = findPairRange(doc, new Position(0, 5), '(', ')', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 2, 'Start at inner opening paren');
                assert.strictEqual(range.end.character, 8, 'End at inner closing paren');
            });

            test('empty parentheses', () => {
                const doc = createDocument('()');
                const range = findPairRange(doc, new Position(0, 1), '(', ')', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start after opening paren');
                assert.strictEqual(range.end.character, 1, 'End before closing paren (empty)');
            });

            test('cursor before opening paren should find first pair', () => {
                const doc = createDocument('(test)');
                const range = findPairRange(doc, new Position(0, 0), '(', ')', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Should find first paren pair');
            });
        });

        suite('braces', () => {
            test('inner braces', () => {
                const doc = createDocument('{Hello, world!}');
                const range = findPairRange(doc, new Position(0, 5), '{', '}', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start after opening brace');
                assert.strictEqual(range.end.character, 14, 'End before closing brace');
            });

            test('nested braces should find innermost', () => {
                const doc = createDocument('{{nested}}');
                const range = findPairRange(doc, new Position(0, 5), '{', '}', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 2, 'Start at inner opening brace');
                assert.strictEqual(range.end.character, 8, 'End at inner closing brace');
            });
        });

        suite('brackets', () => {
            test('inner brackets', () => {
                const doc = createDocument('[Hello, world!]');
                const range = findPairRange(doc, new Position(0, 5), '[', ']', true);
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 1, 'Start after opening bracket');
                assert.strictEqual(range.end.character, 14, 'End before closing bracket');
            });
        });

        suite('multi-line pairs', () => {
            test('parentheses across multiple lines', () => {
                const doc = createDocument('(\nline1\nline2\n)');
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
            test('cursor in middle of word', () => {
                const doc = createDocument('hello world');
                const range = getTextObjectRange(doc, new Position(0, 2), 'iw');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0, 'Should start at word start');
                assert.strictEqual(range.end.character, 5, 'Should end at word end');
            });

            test('cursor at start of word', () => {
                const doc = createDocument('hello world');
                const range = getTextObjectRange(doc, new Position(0, 0), 'iw');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0);
                assert.strictEqual(range.end.character, 5);
            });

            test('cursor at end of word', () => {
                const doc = createDocument('hello world');
                const range = getTextObjectRange(doc, new Position(0, 4), 'iw');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0);
                assert.strictEqual(range.end.character, 5);
            });

            test('cursor on second word', () => {
                const doc = createDocument('hello world');
                const range = getTextObjectRange(doc, new Position(0, 7), 'iw');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 6, 'Should start at second word');
                assert.strictEqual(range.end.character, 11, 'Should end at second word end');
            });
        });

        suite('aw (around word)', () => {
            test('should include trailing whitespace', () => {
                const doc = createDocument('hello world');
                const range = getTextObjectRange(doc, new Position(0, 2), 'aw');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0, 'Should start at word start');
                assert.strictEqual(range.end.character, 6, 'Should include trailing space');
            });
        });

        suite('iW (inner WORD)', () => {
            test('whitespace-delimited WORD', () => {
                const doc = createDocument('hello_world foo');
                const range = getTextObjectRange(doc, new Position(0, 5), 'iW');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0, 'Should start at WORD start');
                assert.strictEqual(range.end.character, 11, 'Should end at WORD end');
            });

            test('cursor in middle of WORD', () => {
                const doc = createDocument('foo-bar+baz');
                const range = getTextObjectRange(doc, new Position(0, 4), 'iW');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0);
                assert.strictEqual(range.end.character, 11);
            });
        });

        suite('aW (around WORD)', () => {
            test('should include trailing whitespace', () => {
                const doc = createDocument('foo-bar baz');
                const range = getTextObjectRange(doc, new Position(0, 3), 'aW');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0);
                assert.strictEqual(range.end.character, 8, 'Should include trailing space');
            });
        });
    });

    suite('getTextObjectRange - quote text objects', () => {
        test('i" should call findQuoteRange with inner=true', () => {
            const doc = createDocument('"Hello"');
            const range = getTextObjectRange(doc, new Position(0, 3), 'i"');
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1, 'Should start after opening quote');
            assert.strictEqual(range.end.character, 6, 'Should end before closing quote');
        });

        test('a" should call findQuoteRange with inner=false', () => {
            const doc = createDocument('"Hello"');
            const range = getTextObjectRange(doc, new Position(0, 3), 'a"');
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 0, 'Should start at opening quote');
            assert.strictEqual(range.end.character, 7, 'Should end after closing quote');
        });

        test("i' should work with single quotes", () => {
            const doc = createDocument("'Hello'");
            const range = getTextObjectRange(doc, new Position(0, 3), "i'");
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('i` should work with backticks', () => {
            const doc = createDocument('`Hello`');
            const range = getTextObjectRange(doc, new Position(0, 3), 'i`');
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });
    });

    suite('getTextObjectRange - pair text objects', () => {
        test('i( should find inner parentheses', () => {
            const doc = createDocument('(Hello)');
            const range = getTextObjectRange(doc, new Position(0, 3), 'i(');
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('ib should find inner parentheses (b for block)', () => {
            const doc = createDocument('(Hello)');
            const range = getTextObjectRange(doc, new Position(0, 3), 'ib');
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('i) should find inner parentheses', () => {
            const doc = createDocument('(Hello)');
            const range = getTextObjectRange(doc, new Position(0, 3), 'i)');
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('a( should find outer parentheses', () => {
            const doc = createDocument('(Hello)');
            const range = getTextObjectRange(doc, new Position(0, 3), 'a(');
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 0);
            assert.strictEqual(range.end.character, 7);
        });

        test('i{ should find inner braces', () => {
            const doc = createDocument('{Hello}');
            const range = getTextObjectRange(doc, new Position(0, 3), 'i{');
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('iB should find inner braces (B for block)', () => {
            const doc = createDocument('{Hello}');
            const range = getTextObjectRange(doc, new Position(0, 3), 'iB');
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('i} should find inner braces', () => {
            const doc = createDocument('{Hello}');
            const range = getTextObjectRange(doc, new Position(0, 3), 'i}');
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('i[ should find inner brackets', () => {
            const doc = createDocument('[Hello]');
            const range = getTextObjectRange(doc, new Position(0, 3), 'i[');
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('i] should find inner brackets', () => {
            const doc = createDocument('[Hello]');
            const range = getTextObjectRange(doc, new Position(0, 3), 'i]');
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('i< should find inner angle brackets', () => {
            const doc = createDocument('<Hello>');
            const range = getTextObjectRange(doc, new Position(0, 3), 'i<');
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });

        test('i> should find inner angle brackets', () => {
            const doc = createDocument('<Hello>');
            const range = getTextObjectRange(doc, new Position(0, 3), 'i>');
            assert.ok(range, 'Should find range');
            assert.strictEqual(range.start.character, 1);
            assert.strictEqual(range.end.character, 6);
        });
    });

    suite('getTextObjectRange - motion text objects', () => {
        suite('w (forward to end of word)', () => {
            test('should move from cursor to end of word', () => {
                const doc = createDocument('hello world');
                const range = getTextObjectRange(doc, new Position(0, 2), 'w');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 2, 'Should start at cursor');
                assert.strictEqual(range.end.character, 5, 'Should end at word end');
            });

            test('at word end should move to next word', () => {
                const doc = createDocument('hello world');
                const range = getTextObjectRange(doc, new Position(0, 5), 'w');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 5, 'Should start at cursor');
                assert.strictEqual(range.end.character, 11, 'Should end at next word end');
            });
        });

        suite('b (backward to start of word)', () => {
            test('should move from cursor to start of word', () => {
                const doc = createDocument('hello world');
                const range = getTextObjectRange(doc, new Position(0, 3), 'b');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0, 'Should start at word start');
                assert.strictEqual(range.end.character, 3, 'Should end at cursor');
            });

            test('at word start should move to previous word', () => {
                const doc = createDocument('hello world');
                const range = getTextObjectRange(doc, new Position(0, 6), 'b');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0, 'Should start at previous word');
                assert.strictEqual(range.end.character, 6, 'Should end at cursor');
            });
        });

        suite('e (forward to end of word)', () => {
            test('should move from cursor to end of word', () => {
                const doc = createDocument('hello world');
                const range = getTextObjectRange(doc, new Position(0, 2), 'e');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 2, 'Should start at cursor');
                assert.strictEqual(range.end.character, 5, 'Should end at word end');
            });
        });

        suite('$ (to end of line)', () => {
            test('should move from cursor to end of line', () => {
                const doc = createDocument('hello world');
                const range = getTextObjectRange(doc, new Position(0, 5), '$');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 5, 'Should start at cursor');
                assert.strictEqual(range.end.character, 11, 'Should end at line end');
            });
        });

        suite('0 (to start of line)', () => {
            test('should move from cursor to start of line', () => {
                const doc = createDocument('hello world');
                const range = getTextObjectRange(doc, new Position(0, 7), '0');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 0, 'Should start at line start');
                assert.strictEqual(range.end.character, 7, 'Should end at cursor');
            });
        });

        suite('^ (to first non-whitespace)', () => {
            test('should move to first non-whitespace character', () => {
                const doc = createDocument('  hello world');
                const range = getTextObjectRange(doc, new Position(0, 7), '^');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 2, 'Should start at first non-whitespace');
                assert.strictEqual(range.end.character, 7, 'Should end at cursor');
            });
        });

        suite('h (left)', () => {
            test('should move one character left', () => {
                const doc = createDocument('hello');
                const range = getTextObjectRange(doc, new Position(0, 3), 'h');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 2, 'Should start one left');
                assert.strictEqual(range.end.character, 3, 'Should end at cursor');
            });

            test('at start of line should return null', () => {
                const doc = createDocument('hello');
                const range = getTextObjectRange(doc, new Position(0, 0), 'h');
                assert.strictEqual(range, null, 'Should return null at line start');
            });
        });

        suite('l (right)', () => {
            test('should move one character right', () => {
                const doc = createDocument('hello');
                const range = getTextObjectRange(doc, new Position(0, 2), 'l');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.character, 2, 'Should start at cursor');
                assert.strictEqual(range.end.character, 3, 'Should end one right');
            });

            test('at end of line should return null', () => {
                const doc = createDocument('hello');
                const range = getTextObjectRange(doc, new Position(0, 5), 'l');
                assert.strictEqual(range, null, 'Should return null at line end');
            });
        });

        suite('j (down)', () => {
            test('should select current and next line', () => {
                const doc = createDocument('line1\nline2');
                const range = getTextObjectRange(doc, new Position(0, 3), 'j');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.line, 0, 'Should start at current line');
                assert.strictEqual(range.end.line, 1, 'Should end at next line');
            });
        });

        suite('k (up)', () => {
            test('should select previous and current line', () => {
                const doc = createDocument('line1\nline2');
                const range = getTextObjectRange(doc, new Position(1, 3), 'k');
                assert.ok(range, 'Should find range');
                assert.strictEqual(range.start.line, 0, 'Should start at previous line');
                assert.strictEqual(range.end.line, 1, 'Should end at current line');
            });
        });
    });
});
