import type { Position } from 'vscode';
import type { Context } from '../context';

/**
 * MotionResult: Motion実行の結果
 *
 * match: 通常のマッチ。position を返す
 * matchAsFallback: big file 等で fallback として実行された。position は返さない
 * needsMoreKey: キーが足りない
 * noMatch: マッチしない
 */
export type MotionResult =
    | { result: 'match'; position: Position; remainingKeys: string[] }
    | { result: 'matchAsFallback'; remainingKeys: string[] }
    | { result: 'needsMoreKey' }
    | { result: 'noMatch' };

/**
 * Motion: カーソル移動を行う関数
 *
 * キーシーケンスをパースして、マッチした場合は新しい位置を返す
 * editor が undefined (big file など) の場合は matchAsFallback を返すことができる
 * Motion にモードの概念はない
 */
export type Motion = (context: Context, keys: string[], position: Position) => Promise<MotionResult>;
