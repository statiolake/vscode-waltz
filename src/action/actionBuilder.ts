import { Selection } from 'vscode';
import type { Context } from '../context';
import type { Mode } from '../modesTypes';
import type { Motion } from '../motion/motionTypes';
import type { TextObject, TextObjectMatch } from '../textObject/textObjectTypes';
import { keysParserPrefix, keysParserRegex } from '../utils/keysParser/keysParser';
import type { KeysParser } from '../utils/keysParser/keysParserTypes';
import type { Action, ActionResult } from './actionTypes';

/**
 * 内部ヘルパー: KeysParserとexecute関数からActionを作成
 */
function createAction(
    keysParser: KeysParser,
    modes: Mode[],
    execute: (context: Context, variables: Record<string, string>) => Promise<void>,
    options?: { fallback?: () => Promise<void> },
): Action {
    return async (context: Context, keys: string[]): Promise<ActionResult> => {
        // モードチェック
        if (!modes.includes(context.vimState.mode)) {
            return 'noMatch';
        }

        // キーパース
        const parseResult = keysParser(keys);

        if (parseResult.result === 'noMatch') {
            return 'noMatch';
        }

        if (parseResult.result === 'needsMoreKey') {
            return 'needsMoreKey';
        }

        // editor が undefined の場合 (big file など)
        if (!context.editor) {
            if (options?.fallback) {
                await options.fallback();
                return 'executed';
            }
            return 'noMatch';
        }

        // 実行
        await execute(context, parseResult.variables);
        return 'executed';
    };
}

/**
 * 通常のActionを作成
 */
export function newAction(config: {
    keys: string[];
    modes: Mode[];
    execute: (context: Context & { editor: NonNullable<Context['editor']> }) => Promise<void>;
    fallback?: () => Promise<void>;
}): Action {
    const keysParser = keysParserPrefix(config.keys);
    return createAction(
        keysParser,
        config.modes,
        (context, _variables) => {
            return config.execute(context as Context & { editor: NonNullable<Context['editor']> });
        },
        { fallback: config.fallback },
    );
}

/**
 * 正規表現パターンを使うActionを作成
 */
export function newRegexAction(config: {
    pattern: RegExp;
    partial: RegExp;
    modes: Mode[];
    execute: (
        context: Context & { editor: NonNullable<Context['editor']> },
        variables: Record<string, string>,
    ) => Promise<void>;
    fallback?: () => Promise<void>;
}): Action {
    const keysParser = keysParserRegex(config.pattern, config.partial);
    return createAction(
        keysParser,
        config.modes,
        (context, variables) => {
            return config.execute(context as Context & { editor: NonNullable<Context['editor']> }, variables);
        },
        { fallback: config.fallback },
    );
}

/**
 * MotionをActionに変換
 * Motion自体がキーパースを行うため、単純に委譲する
 */
export function motionToAction(motion: Motion): Action {
    const modes = ['normal'];

    return async (context: Context, keys: string[]): Promise<ActionResult> => {
        // モードチェック
        if (!modes.includes(context.vimState.mode)) return 'noMatch';

        // editor が undefined の場合 (big file など)
        if (!context.editor) {
            // fallback があればキーマッチング後に実行
            if (motion.fallback) {
                const parseResult = motion.keysParser(keys);
                if (parseResult.result === 'match') {
                    await motion.fallback();
                    return 'executed';
                }
                return parseResult.result;
            }
            return 'noMatch';
        }

        // Motion を各カーソル位置で実行
        // 一つでも match 以外があれば、すぐ返す (パフォーマンスのため)
        const results = [];
        for (const selection of context.editor.selections) {
            const result = motion.execute(context, keys, selection.active);
            if (result.result !== 'match') return result.result;
            results.push(result);
        }

        // マッチ・非マッチはすべてのカーソルで同じ結果になるはず
        const firstResult = results[0];
        if (firstResult.result !== 'match') return firstResult.result;

        // すべてのカーソルを新しい位置に移動
        const editor = context.editor;
        editor.selections = results.map((result, index) => {
            const currentSelection = editor.selections[index];

            if (result.result !== 'match') return currentSelection;

            // Normal モードなので、Motion の位置にカーソルを移動するだけ
            return new Selection(result.position, result.position);
        });

        return 'executed';
    };
}

export function textObjectToVisualAction(textObject: TextObject): Action {
    const modes = ['visual', 'visualLine'];
    return async (context: Context, keys: string[]): Promise<ActionResult> => {
        // モードチェック
        if (!modes.includes(context.vimState.mode)) return 'noMatch';

        // editor が undefined の場合は noMatch
        if (!context.editor) return 'noMatch';

        // 各カーソル位置で TextObject を実行
        // 一つでも match 以外があれば、すぐ返す (パフォーマンスのため)
        const results = [];
        for (const selection of context.editor.selections) {
            const result = textObject(context, keys, selection.active);
            if (result.result !== 'match') return result.result;
            results.push(result);
        }

        // 基本的には、anchor は動かさず active をセットする。ただし、anchorが遡るような range が帰ってきた場合
        // は、anchor も調整する。
        const editor = context.editor;
        editor.selections = results.map((result, index) => {
            const currentSelection = editor.selections[index];

            // どちらが anchor になるのかは少し考える必要がある。 w, b などの通常のモーションであれば、片方は今のカーソ
            // ル位置と一致しているはず。そちらを anchor とする。iw など両方が変化してしまう場合は、anchor == start,
            // active == end とみなす。
            const resultAnchor = currentSelection.active.isEqual(result.data.range.end)
                ? result.data.range.end
                : result.data.range.start;
            const resultActive = currentSelection.active.isEqual(result.data.range.end)
                ? result.data.range.start
                : result.data.range.end;

            if (currentSelection.isEmpty) {
                return new Selection(resultAnchor, resultActive);
            }

            if (!currentSelection.isReversed) {
                return new Selection(
                    currentSelection.anchor.isAfterOrEqual(resultAnchor) ? resultAnchor : currentSelection.anchor,
                    resultActive,
                );
            }

            return new Selection(
                currentSelection.anchor.isBeforeOrEqual(resultAnchor) ? resultAnchor : currentSelection.anchor,
                resultActive,
            );
        });

        return 'executed';
    };
}

type ContextWithEditor = Context & { editor: NonNullable<Context['editor']> };

/**
 * Operator + TextObject のActionを作成
 *
 * オペレーター(d, y, c)とTextObjectを組み合わせる
 * 例: dw, diw, d} (MotionはTextObjectに自動変換済み)
 */
export function newOperatorAction(config: {
    operatorKeys: string[];
    modes: Mode[];
    textObjects: TextObject[];
    execute: (context: ContextWithEditor, matches: TextObjectMatch[]) => Promise<void>;
}): Action {
    const operatorParser = keysParserPrefix(config.operatorKeys);

    return async (context: Context, keys: string[]): Promise<ActionResult> => {
        // モードチェック
        if (!config.modes.includes(context.vimState.mode)) {
            return 'noMatch';
        }

        console.log(`Trying operator ${config.operatorKeys.join('')} with keys:`, keys);

        // オペレーターのパース
        const operatorResult = operatorParser(keys);

        if (operatorResult.result === 'noMatch') {
            return 'noMatch';
        }

        if (operatorResult.result === 'needsMoreKey') {
            return 'needsMoreKey';
        }

        // オペレーターがマッチした後のキー
        const remainingKeys = keys.slice(config.operatorKeys.length);

        console.log(
            `Operator ${config.operatorKeys.join('')} matched, original keys:`,
            keys,
            'operator length:',
            config.operatorKeys.length,
            'remaining keys:',
            remainingKeys,
        );

        if (remainingKeys.length === 0) {
            return 'needsMoreKey';
        }

        // editor が undefined の場合は noMatch
        if (!context.editor) return 'noMatch';

        // 各TextObjectを試す
        const editor = context.editor;
        for (const textObject of config.textObjects) {
            // 各カーソル位置でTextObjectを実行
            const results = editor.selections.map((selection) => {
                return textObject(context, remainingKeys, selection.active);
            });

            const firstResult = results[0];

            if (firstResult.result === 'noMatch') {
                continue; // 次のTextObjectを試す
            }

            if (firstResult.result === 'needsMoreKey') {
                return 'needsMoreKey';
            }

            console.log('TextObject matched with result:', firstResult.result);

            // Matchした - TextObjectMatch[] を取得
            const matches = results.map((result, index) => {
                if (result.result === 'match') {
                    console.log(`TextObject result for cursor ${index}:`, result.data.range);
                    return result.data;
                }
                return { range: editor.selections[index] };
            });

            // await で実行
            await config.execute(context as ContextWithEditor, matches);
            return 'executed';
        }

        return 'noMatch';
    };
}
