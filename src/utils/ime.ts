import { exec } from 'node:child_process';
import * as vscode from 'vscode';

export type ImeSwitching = 'never' | 'switchOff' | 'restore';

type PlatformSuffix = 'macOS' | 'windows' | 'linux';

const IME_SWITCHING_KEY = 'waltz.imeSwitching';
const IME_SWITCH_ON_COMMAND_KEY = 'waltz.imeSwitchOnCommand';
const IME_SWITCH_OFF_COMMAND_KEY = 'waltz.imeSwitchOffCommand';
const IME_STATUS_COMMAND_KEY = 'waltz.imeStatusCommand';

function getPlatformSuffix(): PlatformSuffix {
    switch (process.platform) {
        case 'darwin':
            return 'macOS';
        case 'win32':
            return 'windows';
        default:
            return 'linux';
    }
}

function getImeSwitching(): ImeSwitching {
    const value = vscode.workspace.getConfiguration().get<ImeSwitching>(IME_SWITCHING_KEY, 'never');
    return value === 'switchOff' || value === 'restore' ? value : 'never';
}

function getPlatformCommand(baseKey: string): string {
    const suffix = getPlatformSuffix();
    return vscode.workspace.getConfiguration().get<string>(`${baseKey}.${suffix}`, '');
}

function getImeSwitchOnCommand(): string {
    return getPlatformCommand(IME_SWITCH_ON_COMMAND_KEY);
}

function getImeSwitchOffCommand(): string {
    return getPlatformCommand(IME_SWITCH_OFF_COMMAND_KEY);
}

function getImeStatusCommand(): string {
    return getPlatformCommand(IME_STATUS_COMMAND_KEY);
}

function runShell(command: string): Promise<void> {
    if (!command) return Promise.resolve();
    return new Promise((resolve) => {
        exec(command, (error) => {
            if (error && typeof error.code !== 'number') {
                console.error(`Waltz: IME command spawn failed: ${error.message}`);
            }
            resolve();
        });
    });
}

/**
 * Query whether IME is currently ON.
 * Convention: exit 0 → currently OFF, non-zero → currently ON.
 * Returns undefined when no status command is configured or the command failed to spawn.
 */
function queryImeOn(): Promise<boolean | undefined> {
    const cmd = getImeStatusCommand();
    if (!cmd) return Promise.resolve(undefined);
    return new Promise((resolve) => {
        exec(cmd, (error) => {
            if (error && typeof error.code !== 'number') {
                console.error(`Waltz: IME status command spawn failed: ${error.message}`);
                resolve(undefined);
                return;
            }
            const exitCode = error ? (error.code as number) : 0;
            resolve(exitCode !== 0);
        });
    });
}

// IME 状態の追跡: leaving insert/select 時の status を記憶し、entering 時に必要なら復元する。
// undefined は「status 不明」を表し、その場合は restore 時に常に switchOn を実行する。
let imeWasOn: boolean | undefined;

// 直列化用 promise chain: 短時間に複数のモード遷移が起きた場合に、IME 操作と status query を順序保証する。
let pending: Promise<void> = Promise.resolve();

function enqueue(fn: () => Promise<void>): void {
    pending = pending.then(fn).catch((err) => {
        console.error('Waltz: IME operation failed:', err);
    });
}

export function switchImeOff(): void {
    const switching = getImeSwitching();
    if (switching === 'never') return;
    enqueue(async () => {
        if (switching === 'restore') {
            imeWasOn = await queryImeOn();
        }
        await runShell(getImeSwitchOffCommand());
    });
}

export function switchImeOn(): void {
    const switching = getImeSwitching();
    if (switching !== 'restore') return;
    enqueue(async () => {
        if (imeWasOn !== false) {
            await runShell(getImeSwitchOnCommand());
        }
        imeWasOn = undefined;
    });
}
