"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
let previousErrors = new Set();
let isPlaying = false;
let queuedSounds = 0;
let isEnabled = true;
function activate(context) {
    isEnabled = vscode.workspace
        .getConfiguration('errorShouter')
        .get('enabled', true);
    vscode.window.showInformationMessage(`Error Shouter is active! Audio ${isEnabled ? 'enabled' : 'disabled'}.`);
    // Toggle audio on or off.
    const toggleCommand = vscode.commands.registerCommand('error-shouter.toggle', async () => {
        isEnabled = !isEnabled;
        await vscode.workspace
            .getConfiguration('errorShouter')
            .update('enabled', isEnabled, vscode.ConfigurationTarget.Global);
        if (!isEnabled) {
            queuedSounds = 0;
        }
        vscode.window.showInformationMessage(`Error Shouter audio ${isEnabled ? 'enabled' : 'disabled'}.`);
    });
    context.subscriptions.push(toggleCommand);
    // Detect newly reported errors.
    const checkErrors = () => {
        const currentErrors = new Set();
        for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
            for (const diagnostic of diagnostics) {
                if (diagnostic.severity ===
                    vscode.DiagnosticSeverity.Error) {
                    const key = [
                        uri.toString(),
                        diagnostic.range.start.line,
                        diagnostic.range.start.character,
                        diagnostic.message
                    ].join(':');
                    currentErrors.add(key);
                }
            }
        }
        const newErrors = [...currentErrors].filter(error => !previousErrors.has(error));
        previousErrors = currentErrors;
        if (isEnabled) {
            for (const _error of newErrors) {
                playError(context);
            }
        }
    };
    context.subscriptions.push(vscode.languages.onDidChangeDiagnostics(checkErrors));
    checkErrors();
}
function playError(context) {
    if (!isEnabled) {
        return;
    }
    queuedSounds++;
    if (isPlaying) {
        return;
    }
    playNext(context);
}
function playNext(context) {
    if (queuedSounds === 0 || !isEnabled) {
        isPlaying = false;
        queuedSounds = 0;
        return;
    }
    if (process.platform !== 'win32') {
        queuedSounds = 0;
        isPlaying = false;
        vscode.window.showWarningMessage('Error Shouter audio playback currently supports Windows only.');
        return;
    }
    queuedSounds--;
    isPlaying = true;
    const audioPath = path.join(context.extensionPath, 'media', 'error.mp3');
    const escapedPath = audioPath.replace(/'/g, "''");
    const script = `
Add-Type -AssemblyName presentationCore
$player = New-Object System.Windows.Media.MediaPlayer
$player.Open([Uri]::new('${escapedPath}'))
$player.Volume = 1.0
$player.Play()
Start-Sleep -Milliseconds 500
while ($player.NaturalDuration.HasTimeSpan -eq $false) {
    Start-Sleep -Milliseconds 100
}
$duration = $player.NaturalDuration.TimeSpan.TotalMilliseconds
Start-Sleep -Milliseconds ([int]$duration + 200)
$player.Close()
`;
    (0, child_process_1.execFile)('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { windowsHide: true }, (error) => {
        if (error) {
            console.error('Error Shouter audio playback failed:', error);
        }
        isPlaying = false;
        playNext(context);
    });
}
function deactivate() {
    queuedSounds = 0;
}
//# sourceMappingURL=extension.js.map