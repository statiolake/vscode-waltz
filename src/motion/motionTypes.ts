import type { Position } from 'vscode';
import type { Context } from '../context';
import type { KeysParser } from '../utils/keysParser/keysParserTypes';

/**
 * MotionResult: Motion実行の結果
 */
export type MotionResult =
    | { result: 'match'; position: Position; remainingKeys: string[] }
    | { result: 'needsMoreKey' }
    | { result: 'noMatch' };

/**
 * MotionExecutor: Motion の実行関数
 *
 * キーシーケンスをパースして、マッチした場合は新しい位置を返す
 * Motionにmodeの概念はない
 */
export type MotionExecutor = (context: Context, keys: string[], position: Position) => MotionResult;

/**
 * Motion: MotionExecutor と fallback を持つ構造体
 *
 * execute: 通常の実行関数
 * fallback: editor が undefined の場合に実行される関数 (big file など)
 * keysParser: キーパーサー (fallback 時のキーマッチングに使用)
 */
export type Motion = {
    readonly execute: MotionExecutor;
    readonly fallback?: () => Promise<void>;
    readonly keysParser: KeysParser;
};
