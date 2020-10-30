import { platform as osPlatform } from 'os';
import { get as fetch } from 'https';
import * as vscode from "vscode";

let statusBar: vscode.StatusBarItem;
let terminal: vscode.Terminal;

const radio = "https://coderadio-admin.freecodecamp.org/radio/8010/radio.mp3";
const portal = "https://detectportal.firefox.com/success.txt";

async function hasConnection()
{
  return new Promise<boolean>((resolve, reject) => {
    const req = fetch(portal, (res) => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
  });
}

function getPlayer()
{
  let vlc = "/usr/bin/vlc"; // gnu/linux or mac?
  if (osPlatform().includes('win')) {vlc = "C:\\Program Files\\VLC\\vlc.exe";}
  return vscode.workspace.getConfiguration("coderadio").get("vlc_path") || vlc;
}

function updateSidebar(text: string, tooltip: string, command: string)
{
  statusBar.text = text;
  statusBar.tooltip = tooltip;
  statusBar.command = command;
  statusBar.show();
}

async function startTerminal()
{
  terminal?.dispose(); // if there is a running instance
  terminal = vscode.window.createTerminal({ hideFromUser: true });
  terminal.sendText(`"${getPlayer()}" ${radio} --intf dummy`);
}

function stopTerminal()
{
  terminal?.dispose();
  // for some reason, dispose in windows doesnt kill its child processes
  // so we manually kill vlc with taskkill command
  if (osPlatform().includes('win')) {
    const t = vscode.window.createTerminal({ hideFromUser: true });
    t.sendText('taskkill /im "vlc.exe" /f');
    setTimeout(() => t.dispose(), 3000); // proximity until taskkill complete
  }
}

async function playStream()
{
  if (!(await hasConnection())) {
    vscode.window.showInformationMessage("Can't play, no internet connection.");
    return;
  }
  updateSidebar("◼ Code Radio", "◼ Stop playing", "coderadio.stop");
  startTerminal();
}

async function stopStream()
{
  updateSidebar("▶ Code Radio", "▶ Start playing", "coderadio.play");
  stopTerminal();
}

export function activate(context: vscode.ExtensionContext)
{
  let subscriptions = [
    vscode.commands.registerCommand("coderadio.play", playStream),
    vscode.commands.registerCommand("coderadio.stop", stopStream),
  ];

  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    Number.MIN_SAFE_INTEGER
  );
  subscriptions.push(statusBar);

  context.subscriptions.push(...subscriptions);

  stopStream();
}

export function deactivate()
{
  stopStream();
}
