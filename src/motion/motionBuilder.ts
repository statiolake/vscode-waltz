import type { Position, TextEditor } from 'vscode';
import type { Context } from '../context';
import { keysParserPrefix, keysParserRegex } from '../utils/keysParser/keysParser';
import type { VimState } from '../vimState';
import type { Motion, MotionResult } from './motionTypes';

/**
 * 固定キーシーケンスでMotionを作成
 */
export function newMotion(config: {
    keys: string[];
    compute: (context: Context & { editor: TextEditor }, position: Position) => Position;
    fallback?: (vimState: VimState) => Promise<void>;
}): Motion {
    const keysParser = keysParserPrefix(config.keys);

    const execute = (context: Context, keys: string[], position: Position): MotionResult => {
        const parseResult = keysParser(keys);

        if (parseResult.result === 'noMatch') {
            return { result: 'noMatch' };
        }

        if (parseResult.result === 'needsMoreKey') {
            return { result: 'needsMoreKey' };
        }

        // editor が undefined の場合は noMatch を返す (fallback は別途処理)
        if (!context.editor) {
            return { result: 'noMatch' };
        }

        const requestedPosition = config.compute(context as Context & { editor: TextEditor }, position);
        const newPosition = context.editor.document.validatePosition(requestedPosition);
        if (newPosition.character !== requestedPosition.character) {
            context.vimState.keptColumn = requestedPosition.character;
        } else {
            context.vimState.keptColumn = null;
        }
        return { result: 'match', position: requestedPosition, remainingKeys: parseResult.remainingKeys };
    };

    return {
        execute,
        fallback: config.fallback,
        keysParser,
    };
}

/**
 * 正規表現パターンでMotionを作成
 */
export function newRegexMotion(config: {
    pattern: RegExp;
    partial: RegExp;
    compute: (
        context: Context & { editor: TextEditor },
        position: Position,
        variables: Record<string, string>,
    ) => Position;
    fallback?: (vimState: VimState) => Promise<void>;
}): Motion {
    const keysParser = keysParserRegex(config.pattern, config.partial);

    const execute = (context: Context, keys: string[], position: Position): MotionResult => {
        const parseResult = keysParser(keys);

        if (parseResult.result === 'noMatch') {
            return { result: 'noMatch' };
        }

        if (parseResult.result === 'needsMoreKey') {
            return { result: 'needsMoreKey' };
        }

        // editor が undefined の場合は noMatch を返す (fallback は別途処理)
        if (!context.editor) {
            return { result: 'noMatch' };
        }

        const newPosition = config.compute(
            context as Context & { editor: TextEditor },
            position,
            parseResult.variables,
        );
        return { result: 'match', position: newPosition, remainingKeys: parseResult.remainingKeys };
    };

    return {
        execute,
        fallback: config.fallback,
        keysParser,
    };
}
