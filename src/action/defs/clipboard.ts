import * as vscode from 'vscode';
import type { Context } from '../../context';
import { newAction } from '../actionBuilder';
import { delegateAction } from '../actions';
import type { Action } from '../actionTypes';

/**
 * クリップボード操作アクション (Cmd+C/X/Vのオーバーライド)
 */
export function buildClipboardActions(): Action[] {
    const actions: Action[] = [];

    // Cmd+C - Normal mode: 行全体をyank (yy相当)
    actions.push(
        newAction({
            keys: ['<Waltz>copy'],
            modes: ['normal'],
            execute: async (context: Context) => {
                await delegateAction(context.vimState.actions, context, ['y', 'y']);
            },
            fallback: async () => {
                await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
            },
        }),
    );

    // Cmd+C - Visual mode: 選択範囲をyank (y相当)
    actions.push(
        newAction({
            keys: ['<Waltz>copy'],
            modes: ['visual'],
            execute: async (context: Context) => {
                await delegateAction(context.vimState.actions, context, ['y']);
            },
            fallback: async () => {
                await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
            },
        }),
    );

    // Cmd+X - Normal mode: 行全体をカット (dd相当)
    actions.push(
        newAction({
            keys: ['<Waltz>cut'],
            modes: ['normal'],
            execute: async (context: Context) => {
                await delegateAction(context.vimState.actions, context, ['d', 'd']);
            },
            fallback: async () => {
                await vscode.commands.executeCommand('editor.action.clipboardCutAction');
            },
        }),
    );

    // Cmd+X - Visual mode: 選択範囲をカット (d相当)
    actions.push(
        newAction({
            keys: ['<Waltz>cut'],
            modes: ['visual'],
            execute: async (context: Context) => {
                await delegateAction(context.vimState.actions, context, ['d']);
            },
            fallback: async () => {
                await vscode.commands.executeCommand('editor.action.clipboardCutAction');
            },
        }),
    );

    // Cmd+V - Normal/Visual mode: ペースト (p相当)
    actions.push(
        newAction({
            keys: ['<Waltz>paste'],
            modes: ['normal', 'visual'],
            execute: async (context: Context) => {
                await delegateAction(context.vimState.actions, context, ['p']);
            },
            fallback: async () => {
                await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
            },
        }),
    );

    return actions;
}
