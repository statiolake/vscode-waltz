import type * as vscode from 'vscode';
import type { VimState } from '../vimState';
import { registerEditCommands } from './edit';
import { registerFindCommands } from './find';
import { registerGotoCommands } from './goto';
import { registerModeCommands } from './mode';
import { registerMotionCommands } from './motion';
import { registerOperatorCommands } from './operator';

/**
 * Register all new commands
 */
export function registerCommands(context: vscode.ExtensionContext, getVimState: () => VimState): void {
    registerGotoCommands(context);
    registerFindCommands(context, getVimState);
    registerOperatorCommands(context, getVimState);
    registerModeCommands(context, getVimState);
    registerEditCommands(context, getVimState);
    registerMotionCommands(context, getVimState);
}
