import type * as vscode from 'vscode';
import type { VimState } from '../vimState';
import { registerEditCommands } from './edit';
import { registerFindCommands } from './find';
import { registerModeCommands } from './mode';
import { registerMotionCommands } from './motion';
import { registerOperatorCommands } from './operator';
import { registerViewportCommands } from './viewport';

/**
 * Register all commands
 */
export function registerCommands(context: vscode.ExtensionContext, getVimState: () => VimState): void {
    registerFindCommands(context, getVimState);
    registerOperatorCommands(context, getVimState);
    registerModeCommands(context, getVimState);
    registerEditCommands(context, getVimState);
    registerMotionCommands(context);
    registerViewportCommands(context);
}
