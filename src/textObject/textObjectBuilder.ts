import type { Position, Range, TextEditor } from 'vscode';
import * as vscode from 'vscode';
import type { Context } from '../context';
import { keysParserPrefix, keysParserRegex } from '../utils/keysParser/keysParser';
import type { TextObject, TextObjectResult } from './textObjectTypes';

type ContextWithEditor = Context & { editor: TextEditor };

/**
 * 固定キーシーケンスでTextObjectを作成
 */
export function newTextObject(config: {
    keys: string[];
    compute: (context: ContextWithEditor, position: Position) => Range | 'noMatch';
}): TextObject {
    const keysParser = keysParserPrefix(config.keys);

    return async (context: Context, keys: string[], position: Position): Promise<TextObjectResult> => {
        const parseResult = keysParser(keys);

        if (parseResult.result === 'noMatch') {
            return { result: 'noMatch' };
        }

        if (parseResult.result === 'needsMoreKey') {
            return { result: 'needsMoreKey' };
        }

        // editor が undefined の場合は noMatch
        if (!context.editor) {
            return { result: 'noMatch' };
        }

        const range = config.compute(context as ContextWithEditor, position);
        if (range === 'noMatch') {
            return { result: 'noMatch' };
        }
        return { result: 'match', data: { range }, remainingKeys: parseResult.remainingKeys };
    };
}

/**
 * 正規表現パターンでTextObjectを作成
 */
export function newRegexTextObject(config: {
    pattern: RegExp;
    partial: RegExp;
    compute: (context: ContextWithEditor, position: Position, variables: Record<string, string>) => Range | 'noMatch';
}): TextObject {
    const keysParser = keysParserRegex(config.pattern, config.partial);

    return async (context: Context, keys: string[], position: Position): Promise<TextObjectResult> => {
        const parseResult = keysParser(keys);

        if (parseResult.result === 'noMatch') {
            return { result: 'noMatch' };
        }

        if (parseResult.result === 'needsMoreKey') {
            return { result: 'needsMoreKey' };
        }

        // editor が undefined の場合は noMatch
        if (!context.editor) {
            return { result: 'noMatch' };
        }

        const range = config.compute(context as ContextWithEditor, position, parseResult.variables);
        if (range === 'noMatch') {
            return { result: 'noMatch' };
        }
        return { result: 'match', data: { range }, remainingKeys: parseResult.remainingKeys };
    };
}

export function newWholeLineTextObject(config: { keys: string[]; includeLineBreak: boolean }): TextObject {
    const baseTextObject = newTextObject({
        keys: config.keys,
        compute: (context: ContextWithEditor, position: Position) => {
            const document = context.editor.document;
            const line = document.lineAt(position.line);

            if (!config.includeLineBreak) {
                return line.range;
            }

            // 改行を含む場合は基本的には行末の \n を併せて削除する形にするが、最終行だけは末尾の改行がない可能性があ
            // る。そのため、最終行においては行頭の \n を削除することで再現する。
            const isLastLine = position.line === document.lineCount - 1;
            const hasTrailingNewline = line.rangeIncludingLineBreak.end.isAfter(line.range.end);
            if (isLastLine && !hasTrailingNewline && position.line > 0) {
                // 前の行の末尾（改行の開始位置）から現在の行の末尾まで
                const prevLine = document.lineAt(position.line - 1);
                return new vscode.Range(prevLine.range.end, line.range.end);
            }

            // それ以外の場合は通常通り
            return line.rangeIncludingLineBreak;
        },
    });

    // newWholeLineTextObject の結果に isLinewise: true を付与
    return async (context: Context, keys: string[], position: Position): Promise<TextObjectResult> => {
        const result = await baseTextObject(context, keys, position);
        if (result.result === 'match') {
            return {
                result: 'match',
                data: { range: result.data.range, isLinewise: true },
                remainingKeys: result.remainingKeys,
            };
        }
        return result;
    };
}
