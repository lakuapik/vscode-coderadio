import { get as fetch } from 'https';
import * as vscode from "vscode";
import { ChildProcess,  spawn,  } from 'child_process';

import * as fs from 'fs';
import * as path from 'path';
import { kill } from 'process';

const isWin = (process.platform == 'win32');
let statusBar: vscode.StatusBarItem;
let volumeValue: vscode.StatusBarItem;

let GlobalState: vscode.Memento;
let localState:{
  player:ChildProcess|null,
  playerVolume:number,
  playerState:boolean
} = {
  player : null,
  playerVolume:20,
  playerState:false
}

 
const radio = "https://coderadio-admin.freecodecamp.org/radio/8010/radio.mp3";
const portal = "https://detectportal.firefox.com/success.txt";

async function hasConnection() {
  return new Promise<boolean>((resolve, reject) => {
    const req = fetch(portal, (res) => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
  });
}

function killProcess(pid: number) {
  if (!isWin) spawn("kill", ['-9', pid.toString()])
  else spawn("taskkill", ['/PID', pid.toString(), '/F'])
}

function getPlayer(): ChildProcess {
  let p = GlobalState.get("player") as ChildProcess
  if (p && p.connected && !p.killed) 
    return p as ChildProcess;

  else {
    if (p && !p.connected && !p.killed) {
      killProcess(p.pid)
    }
    let vlc_path_str = vscode.workspace.getConfiguration("coderadio").get("vlc_path") as string
    let vlc_path = []
    if (!vlc_path_str) {
      vlc_path = []
      //we can do better, but this is kindof okay

      if (isWin && process.env['ProgramFiles'])
        vlc_path.push(path.join(process.env['ProgramFiles'], 'VideoLAN/VLC/vlc.exe'));

      if (isWin && process.env['ProgramFiles(x86)'])
        vlc_path.push(path.join(process.env['ProgramFiles(x86)'], 'VideoLAN/VLC/vlc.exe'));

      if (!isWin)
        vlc_path.push("/usr/bin/cvlc");
    } else {
      vlc_path = [vlc_path_str]

    }

    let vlc = vlc_path.find(bin => fs.existsSync(bin));

    if (!vlc)
      throw `Cannot find vlc path`;
    let volume = GlobalState.get("playerVolume")
    if (volume===undefined) {
      volume = 20

      GlobalState?.update("playerVolume", volume)
    }
    let args = [radio, "--gain", (volume as number / 100).toString(), "--volume-step", ( 128).toString()]
    if (vlc_path_str) {
      args.push("--intf")
      args.push("dummy")
    }
    let player = spawn.bind(null, vlc).apply(null, [args, {}]);

    return player
  }

}

function refreshPlayerState() {
   
  if( localState.playerState){

    statusBar.text = "◼";
    statusBar.tooltip = "◼ Stop playing";
    statusBar.command = "coderadio.stop";
  
  }else{

    statusBar.text = "▶";
    statusBar.tooltip = "▶ Start playing";
    statusBar.command = "coderadio.play";
  } 
}
function refreshVolumeState() {
  let volume = GlobalState.get("playerVolume") as number
  volumeValue.text = volume + "% 🕨"
  localState.playerVolume=volume
}

async function startTerminal() {
  if (!(await hasConnection())) {
    vscode.window.showInformationMessage("Can't play, no internet connection.");
    return;
  }
  localState.playerState = true
  localState.player = getPlayer()

  GlobalState.update("player", localState.player)

  GlobalState.update("playerState", localState.playerState)



}

function stopTerminal() {

  let p = GlobalState.get("player") as ChildProcess 
   
  killProcess(p.pid)
  if(localState.player && localState.player?.pid !== p.pid){
    killProcess(localState.player!.pid)
  }
  localState.playerState = false
  localState.player = p 
  GlobalState.update("player", localState.player)

  GlobalState.update("playerState", localState.playerState)
}
async function listenerHandler(){
   
    setTimeout(()=>{
      let volume = GlobalState.get("playerVolume")
      if(volume != localState.playerVolume){
        refreshVolumeState()
      }
      let player = GlobalState.get("player") as ChildProcess
      let playerState =  GlobalState.get("playerState");
      if(player && localState.player!== null && player.pid != localState.player.pid){
          killProcess(localState.player.pid)
          localState.player = player;
          refreshPlayerState();
      }else if(playerState!= localState.playerState){
        localState.playerState =   playerState as boolean;
        refreshPlayerState();

      }

      listenerHandler()
    },100)
 
   
}
async function playStream() {
  if (!(await hasConnection())) {
    vscode.window.showInformationMessage("Can't play, no internet connection.");
    return;
  }
  await startTerminal();
  refreshPlayerState() 

}

async function restartStream() {
  stopTerminal();
  
  let volume = GlobalState.get("playerVolume") as number
  if(volume>0){
    await startTerminal();
  }
}

//subscription functions

async function stopStream() {
 

  stopTerminal();
  refreshPlayerState() 

}

async function upVolume() {
  let volume = GlobalState.get("playerVolume") as number
  if (volume < 100) {
      volume += 5;

  }

  GlobalState?.update("playerVolume", volume)
  refreshVolumeState()
  if (localState.playerState) {
    await restartStream()
  }

}
async function downVolume() {
  let volume = GlobalState.get("playerVolume") as number

  if (volume > 0) {  
      volume -= 5;  
  }
  GlobalState?.update("playerVolume", volume)

  refreshVolumeState()

  if (localState.playerState) {
    await restartStream()


  }

}


//extension lifecycle functions
export function activate(context: vscode.ExtensionContext) {


  //get global state player
  GlobalState = context.globalState 
  context.globalState.setKeysForSync(["player","playerVolume,playerState"])

  let p = GlobalState.get("player") as ChildProcess
  if (p) {

    let volume = GlobalState.get("playerVolume") as number
    if (!volume) {
      GlobalState?.update("playerVolume", 20)

    }
     

  }  

  listenerHandler()

  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    Number.MIN_SAFE_INTEGER
  );


  let radioName = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    Number.MIN_SAFE_INTEGER
  );
  let { volumeUp, volumeDown } = initVolumeButtons()


  radioName.text = "Code Radio"



  let subscriptions = [
    vscode.commands.registerCommand("coderadio.play", playStream),
    vscode.commands.registerCommand("coderadio.stop", stopStream),
    vscode.commands.registerCommand("coderadio.volumedown", downVolume),
    vscode.commands.registerCommand("coderadio.volumeup", upVolume),


  ];
  context.subscriptions.push(...subscriptions);


  radioName.show()
 
  refreshPlayerState()
  refreshVolumeState()

  statusBar.show();


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
  return { volumeUp, volumeDown }
}


 

export function deactivate() {
  stopStream();
}
