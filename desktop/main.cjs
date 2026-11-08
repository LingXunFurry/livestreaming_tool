const {app,BrowserWindow,Menu,dialog,clipboard,shell} = require('electron');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const path = require('node:path');
const execute = promisify(execFile);
const root = path.resolve(__dirname,'..');
const dataDir = process.env.TAVERN_DATA_DIR || path.join(app.getPath('appData'),'LingxunTavern');
let window;
let origin;
let quitting = false;
let exitPending = false;

async function runtime(command) {
  const {stdout} = await execute(process.execPath,[path.join(root,'scripts','runtime.mjs'),command,'--json'],{
    cwd:root,windowsHide:true,timeout:60000,
    env:{...process.env,ELECTRON_RUN_AS_NODE:'1',TAVERN_DATA_DIR:dataDir,...(app.isPackaged ? {TAVERN_PREBUILT:'1'} : {})},
  });
  const result=JSON.parse(stdout.trim());
  if(result.state==='ERROR') throw Error(result.message);
  return result;
}

function navigate(route) {
  if(origin) void window.loadURL(origin+route);
}

function protect(browser) {
  browser.webContents.on('will-navigate',(event,url)=>{
    if(!origin || new URL(url).origin!==origin) event.preventDefault();
  });
  browser.webContents.setWindowOpenHandler(({url})=>{
    if(origin && new URL(url).origin===origin) preview(url);
    return {action:'deny'};
  });
  browser.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
}

function preview(url) {
  const child=new BrowserWindow({width:1200,height:740,minWidth:640,minHeight:420,parent:window,backgroundColor:'#142238',autoHideMenuBar:true,
    webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  protect(child);
  if(new URL(url).pathname.startsWith('/live/')){
    const fit=()=>{const [width,height]=child.getContentSize();child.webContents.setZoomFactor(Math.min(width/1920,height/1080));};
    child.on('resize',fit);
    child.webContents.on('did-finish-load',fit);
  }
  void child.loadURL(url);
}

async function startService() {
  const status=await runtime('start');
  origin=`http://127.0.0.1:${status.port}`;
  navigate('/admin');
}

async function action(callback) {
  try {await callback();}
  catch(error) {await dialog.showMessageBox(window,{type:'error',message:'操作未完成',detail:error.message});}
}

async function requestExit() {
  if(exitPending || quitting) return;
  exitPending=true;
  const {response}=await dialog.showMessageBox(window,{
    type:'question',message:'关闭酒馆控制应用',detail:'直播网页与网易云桥接可继续在后台运行。',
    buttons:['关闭窗口，保留直播服务','停止服务并退出','取消'],defaultId:0,cancelId:2,
  });
  if(response===2){exitPending=false;return;}
  if(response===1){
    try {await runtime('stop');}
    catch(error) {exitPending=false;await dialog.showMessageBox(window,{type:'error',message:'服务停止失败',detail:error.message});return;}
  }
  quitting=true;
  app.quit();
}

if(!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
  app.whenReady().then(async()=>{
    window=new BrowserWindow({width:1440,height:1000,minWidth:900,minHeight:650,title:'凌巽的酒馆',backgroundColor:'#142238',
      webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
    protect(window);
    window.on('close',event=>{if(!quitting){event.preventDefault();void requestExit();}});
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label:'管理后台',submenu:[{label:'文字、字号与音乐设置',click:()=>navigate('/admin')},{label:'打开设置与日志目录',click:()=>void shell.openPath(dataDir)}]},
      {label:'预览',submenu:[
        {label:'B 站实时画面',click:()=>origin&&preview(origin+'/live/bilibili')},
        {label:'抖音实时画面',click:()=>origin&&preview(origin+'/live/douyin')},
        {label:'场景与美术预览',click:()=>navigate('/scene/review')},
        {label:'独立像素素材',click:()=>navigate('/assets/review')},
      ]},
      {label:'直播服务',submenu:[
        {label:'启动或连接服务',click:()=>void action(startService)},
        {label:'停止服务',click:()=>void action(async()=>{await runtime('stop');await dialog.showMessageBox(window,{message:'直播服务已停止',detail:'通过菜单“启动或连接服务”可重新开启。'});})},
        {label:'检查运行状态',click:()=>void action(async()=>{const status=await runtime('status');await dialog.showMessageBox(window,{message:`服务状态 ${status.state}`,detail:`网易云 ${status.adapters?.music?.state||'未启动'}\nB 站 ${status.adapters?.bilibili?.state||'未启动'}`});})},
        {type:'separator'},
        {label:'复制 B 站直播源地址',click:()=>origin&&clipboard.writeText(origin+'/live/bilibili')},
        {label:'复制抖音直播源地址',click:()=>origin&&clipboard.writeText(origin+'/live/douyin')},
        {type:'separator'},{label:'退出',click:()=>void requestExit()},
      ]},
      {label:'窗口',submenu:[{role:'reload'},{role:'toggleDevTools'},{role:'togglefullscreen'}]},
    ]));
    try {await startService();}
    catch(error) {
      await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<meta charset="utf-8"><body style="background:#142238;color:#F3ECDD;font:20px sans-serif;padding:48px"><h1>凌巽的酒馆</h1><p>通过顶部“直播服务”菜单重试启动，或检查设置与日志目录。</p></body>'));
      await dialog.showMessageBox(window,{type:'error',message:'酒馆启动失败',detail:error.message});
    }
  });
  app.on('before-quit',event=>{if(!quitting){event.preventDefault();void requestExit();}});
}
