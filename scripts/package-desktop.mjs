import {packager} from '@electron/packager';
import {access,cp,mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const execute=promisify(execFile);
const root=fileURLToPath(new URL('../',import.meta.url));
if(process.platform!=='win32') throw Error('桌面封装需要 Windows x64');
const pythonCache=path.join(root,'.cache','desktop-python');
const archive=path.join(root,'.cache','python-3.14.3-embed-amd64.zip');
await mkdir(pythonCache,{recursive:true});
if(!await stat(path.join(pythonCache,'python.exe')).catch(()=>null)){
  const response=await fetch('https://www.python.org/ftp/python/3.14.3/python-3.14.3-embed-amd64.zip');
  if(!response.ok) throw Error('Python 运行环境下载失败 '+response.status);
  await writeFile(archive,Buffer.from(await response.arrayBuffer()));
  await execute('powershell.exe',['-NoProfile','-Command','Expand-Archive -LiteralPath $env:TAVERN_PYTHON_ARCHIVE -DestinationPath $env:TAVERN_PYTHON_TARGET -Force'],{
    windowsHide:true,env:{...process.env,TAVERN_PYTHON_ARCHIVE:archive,TAVERN_PYTHON_TARGET:pythonCache},
  });
}
const sitePackages=path.join(root,'.cache','netease-venv','Lib','site-packages');
const bridge=path.join(root,'.cache','netease-bridge');
await access(path.join(sitePackages,'pymem'));
await access(path.join(bridge,'main.py'));
const [output]=await packager({
  dir:root,out:path.join(root,'release'),platform:'win32',arch:'x64',
  name:'凌巽的酒馆',executableName:'凌巽的酒馆',overwrite:true,asar:false,
  download:{checksums:JSON.parse(await readFile(path.join(root,'node_modules','electron','checksums.json'),'utf8'))},
  ignore:[
    /^\/(?!desktop(?:\/|$)|dist(?:\/|$)|server(?:\/|$)|config(?:\/|$)|scripts(?:\/|$)|node_modules(?:\/|$)|package\.json$)/,
    /^\/config\/local\.json$/,
    /^\/scripts\/(?!runtime\.mjs$|music-bridge\.py$)/,
  ],
  win32metadata:{CompanyName:'LingXun',FileDescription:'凌巽的酒馆直播控制台',ProductName:'凌巽的酒馆'},
});
const appRoot=path.join(output,'resources','app');
const bundledPython=path.join(appRoot,'.cache','netease-venv','Scripts');
await cp(pythonCache,bundledPython,{recursive:true});
await writeFile(path.join(bundledPython,'python314._pth'),'python314.zip\n.\nLib/site-packages\nimport site\n');
await cp(sitePackages,path.join(bundledPython,'Lib','site-packages'),{
  recursive:true,filter:file=>!file.split(path.sep).some(part=>part==='__pycache__'||part==='pip'||part.startsWith('pip-')),
});
await mkdir(path.join(appRoot,'.cache','netease-bridge'),{recursive:true});
for(const file of ['main.py','README.md','offset_cache.json']){
  await cp(path.join(bridge,file),path.join(appRoot,'.cache','netease-bridge',file));
}
await writeFile(path.join(output,'使用说明.txt'),'双击“凌巽的酒馆.exe”启动。\n顶部菜单包含后台、实时预览、素材预览和直播服务控制。\n请将整个文件夹保存在一起。\n设置和日志保存在 %APPDATA%\\LingxunTavern。\n关闭窗口时可选择保留直播服务或停止后退出。\n网易云需在本机安装并启动，当前适配 Windows 客户端 3.1.41。\n');
console.log(path.join(output,'凌巽的酒馆.exe'));
