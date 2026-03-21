import * as vscode from 'vscode';
import type { Mode } from '../modesTypes';

export type PreferredMode = Extract<Mode, 'normal' | 'insert'>;

const PREFERRED_MODE_CONFIG_KEY = 'waltz.preferredMode';
const DEFAULT_PREFERRED_MODE: PreferredMode = 'normal';

export function getPreferredMode(): PreferredMode {
    const configuredMode = vscode.workspace
        .getConfiguration()
        .get<PreferredMode>(PREFERRED_MODE_CONFIG_KEY, DEFAULT_PREFERRED_MODE);

    return configuredMode === 'insert' ? 'insert' : 'normal';
}
