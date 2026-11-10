import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
if (process.platform !== 'darwin') throw new Error('iOS projesini macOS üzerinde hazırla.');
const run=(program,args)=>execFileSync(program,args,{stdio:'inherit'});
if (!existsSync('ios/App/App.xcodeproj')) run('cap',['add','ios','--packagemanager','SPM']);
const plist='ios/App/App/Info.plist';
for (const [key, description] of Object.entries({
  NSMicrophoneUsageDescription:'Günlüğüne sesli anı eklemek için mikrofon kullanılır.',
  NSCameraUsageDescription:'Günlüğüne fotoğraf çekip eklemek için kamera kullanılır.',
  NSPhotoLibraryUsageDescription:'Günlüğüne seçtiğin fotoğrafı eklemek için fotoğraf arşivi kullanılır.'
})) {
  run('/usr/bin/plutil',['-replace',key,'-string',description,plist]);
}
run('cap',['sync','ios']);
