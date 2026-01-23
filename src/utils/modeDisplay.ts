import * as vscode from 'vscode';
import type { Mode } from '../modesTypes';

const defaultModeDisplays: Record<Mode, string> = {
    normal: '-- NORMAL --',
    insert: '-- INSERT --',
    visual: '-- VISUAL --',
};

function getModeDisplayLabelConfigKey(mode: Mode): string {
    return `waltz.modeDisplay.${mode}.label`;
}

export function getModeDisplayText(mode: Mode, isLimited = false): string {
    const configKey = getModeDisplayLabelConfigKey(mode);
    const config = vscode.workspace.getConfiguration();
    const displayText = config.get<string>(configKey, defaultModeDisplays[mode]);

    const text = displayText ?? defaultModeDisplays[mode];
    return isLimited ? `${text} (limited)` : text;
}
