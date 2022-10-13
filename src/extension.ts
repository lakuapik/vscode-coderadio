import { platform as osPlatform } from 'os';
import { get as fetch } from 'https';
import * as vscode from "vscode";
import { ChildProcess, ChildProcessWithoutNullStreams, spawn, SpawnOptions } from 'child_process';

import * as fs from 'fs';
import * as path from 'path';

const isWin = (process.platform == 'win32');
let statusBar: vscode.StatusBarItem;
let volumeValue: vscode.StatusBarItem;

let GlobalState: vscode.Memento;
let task: vscode.Task;
let terminal: vscode.Terminal;
let playingState = false;
let platform: string = osPlatform()
let tmpPlayer: ChildProcess;
const radio = "https://coderadio-admin.freecodecamp.org/radio/8010/radio.mp3";
const portal = "https://detectportal.firefox.com/success.txt";

async function hasConnection() {
  return new Promise<boolean>((resolve, reject) => {
    const req = fetch(portal, (res) => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
  });
}

function killProcess(pid:number) {
  if (!isWin) spawn("kill", ['-9', pid.toString()])
  else spawn("taskkill", ['/PID', pid.toString(), '/F'])
}

function getPlayer(): ChildProcess {
  let p = GlobalState.get("player") as ChildProcess
  if (p && p.connected && !p.killed) return p as ChildProcess;

  else {
    if (p && !p.connected && !p.killed) {
      killProcess(p.pid)
    }
    let vlc_path = [];

    //we can do better, but this is kindof okay

    if (isWin && process.env['ProgramFiles'])
      vlc_path.push(path.join(process.env['ProgramFiles'], 'VideoLAN/VLC/vlc.exe'));

    if (isWin && process.env['ProgramFiles(x86)'])
      vlc_path.push(path.join(process.env['ProgramFiles(x86)'], 'VideoLAN/VLC/vlc.exe'));

    if (!isWin)
      vlc_path.push("/usr/bin/cvlc");

    let vlc = vlc_path.find(bin => fs.existsSync(bin));

    if (!vlc)
      throw `Cannot find vlc path`;
    let volume = GlobalState.get("playerVolume")
    if (!volume) {
      volume = 20

      GlobalState?.update("playerVolume", volume)
    }
    let player = spawn.bind(null, vlc).apply(null, [[radio, "--gain", (volume as number / 100).toString(), "--volume-step", (volume as number / 128).toString()], {}]);

    GlobalState.update("player", player)
    return player
  }

}

function updateSidebar(text: string, tooltip: string, command: string) {
  statusBar.text = text;
  statusBar.tooltip = tooltip;
  statusBar.command = command;
  statusBar.show();
}

async function startTerminal() {
  tmpPlayer = getPlayer()



}

function stopTerminal() {

  let p = GlobalState.get("player") as ChildProcess
  if (tmpPlayer) tmpPlayer.kill("SIGKILL")
  else if (p && !p.connected && !p.killed) {
    killProcess(p.pid)

    tmpPlayer = p
  }

  GlobalState.update("player", tmpPlayer)


}

async function playStream() {
  if (!(await hasConnection())) {
    vscode.window.showInformationMessage("Can't play, no internet connection.");
    return;
  }
  updateSidebar("◼", "◼ Stop playing", "coderadio.stop");
  playingState = true;
  startTerminal();
}

async function restartStream() {
  stopTerminal();
  if (!(await hasConnection())) {
    vscode.window.showInformationMessage("Can't play, no internet connection.");
    return;
  }
  startTerminal();
}
async function upVolume() {
  let volume = GlobalState.get("playerVolume") as number
  if (volume < 100) {
    volume += 10;
    GlobalState?.update("playerVolume", volume)

    refreshVolumeText()

  }
  if (playingState) {
    restartStream()
  }


}
async function downVolume() {
  let volume = GlobalState.get("playerVolume") as number

  if (volume > 0) {
    volume -= 10;
    GlobalState?.update("playerVolume", volume)

    refreshVolumeText()

  }
  if (playingState) {
    restartStream()


  }

}


async function stopStream() {
  updateSidebar("▶", "▶ Start playing", "coderadio.play");
  playingState = false;


  stopTerminal();
}

export function activate(context: vscode.ExtensionContext) {


  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    Number.MIN_SAFE_INTEGER
  );


  let radioName = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    Number.MIN_SAFE_INTEGER
  );

  radioName.text = "Code Radio"



  let subscriptions = [
    vscode.commands.registerCommand("coderadio.play", playStream),
    vscode.commands.registerCommand("coderadio.stop", stopStream),
    vscode.commands.registerCommand("coderadio.volumedown", downVolume),
    vscode.commands.registerCommand("coderadio.volumeup", upVolume),


  ];
  context.subscriptions.push(...subscriptions);


  radioName.show()

  //get global state player
  GlobalState = context.globalState
  let p = GlobalState.get("player") as ChildProcess
  if (p) {

    let volume = GlobalState.get("playerVolume") as number
    if (!volume) {
      GlobalState?.update("playerVolume", 20)

    }
    if (!p.killed) {
      updateSidebar("◼", "◼ Stop playing", "coderadio.stop");

    } else {
      updateSidebar("▶", "▶ Start playing", "coderadio.play");

    }

  } else {
    updateSidebar("▶", "▶ Start playing", "coderadio.play");

  }
  let { volumeUp, volumeDown } = initVolumeButtons()

  volumeUp.show()

  volumeDown.show()
  volumeValue.show()
}

function initVolumeButtons() {
  let volumeUp = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    Number.MIN_SAFE_INTEGER
  );
  volumeUp.text = "+"

  volumeUp.command = "coderadio.volumeup"

  let volumeDown = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    Number.MIN_SAFE_INTEGER
  );
  volumeDown.text = "-"

  volumeDown.command = "coderadio.volumedown"

  volumeValue = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    Number.MIN_SAFE_INTEGER
  );
  refreshVolumeText()
  return { volumeUp, volumeDown }
}

function refreshVolumeText() {
  let volume = GlobalState.get("playerVolume")
  volumeValue.text = volume + "% 🕨"
}

export function deactivate() {
  stopStream();
}
