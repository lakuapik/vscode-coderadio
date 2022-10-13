import { platform as osPlatform } from 'os';
import { get as fetch } from 'https';
import * as vscode from "vscode";

let statusBar: vscode.StatusBarItem;
let volumeValue: vscode.StatusBarItem;
let task: vscode.Task;
let terminal: vscode.Terminal;
let volume: number = 20
let playingState = false;
let platform: string = osPlatform()

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
  if (platform.includes('win')) { vlc = "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe"; }
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
  // terminal?.dispose(); // if there is a running instance
  // if (platform.includes('win')) {
  //   terminal = vscode.window.createTerminal({
  //     shellPath: "C:\\Windows\\System32\\cmd.exe", // ensures that the default Windows terminal will open 
  //     name: "coderadio",
  //     hideFromUser: true
  //   });
  //   setTimeout(() => terminal.dispose(), 3000); // it's not necessary to keep the terminal open in windows

  // } else {
  //   terminal = vscode.window.createTerminal({
  //     shellPath: "/bin/bash",
  //     name: "coderadio",
  //     hideFromUser: true
  //   })
  // }
  // terminal.sendText(`"${getPlayer()}" ${radio} --intf dummy --gain ${volume / 100} &`);
  task = new vscode.Task("player","Global", "CodeRadio", "Package Manager",new vscode.ShellExecution(`"${getPlayer()}" ${radio} --intf dummy --gain ${volume / 100} &`));
    vscode.tasks.executeTask(task)


}

function stopTerminal()
{
  vscode
  // terminal?.dispose();
  // // for some reason, dispose in windows doesnt kill its child processes
  // // so we manually kill vlc with taskkill command
  // if (platform.includes('win')) {
  //   const t = vscode.window.createTerminal({
  //     shellPath: "C:\\Windows\\System32\\cmd.exe", // ensures that the default Windows terminal will open
  //     hideFromUser: false
  //   });
  //   t.sendText('taskkill /im "vlc.exe" /f');
  //   setTimeout(() => t.dispose(), 3000); // proximity until taskkill complete
  // }
  

}

async function playStream()
{
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

  if (volume <= 100) {
    volume += 10;
    refreshVolumeText()

  }
  if (playingState) {
    restartStream()
  }


}
async function downVolume() {

  if (volume >= 0) {
    volume -= 10;
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

  let { volumeUp, volumeDown } = initVolumeButtons()


  let subscriptions = [
    vscode.commands.registerCommand("coderadio.play", playStream),
    vscode.commands.registerCommand("coderadio.stop", stopStream),
    vscode.commands.registerCommand("coderadio.volumedown", downVolume),
    vscode.commands.registerCommand("coderadio.volumeup", upVolume),
    radioName,
    statusBar,
    volumeUp,
    volumeDown


  ];
  context.subscriptions.push(...subscriptions);

  radioName.show()
  stopStream();
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
  volumeValue.text = volume + "% 🕨"

}

export function deactivate() {
  stopStream();
}
