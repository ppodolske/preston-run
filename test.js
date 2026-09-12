const fs=require('fs');
const path=require('path');

const source=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
const checks=[
  ['Archive app name', /name:'Archive'/],
  ['Archive URL', /https:\/\/archive\.preston\.run/],
  ['Archive status element', /id="archiveStatus"/],
  ['Archive status update', /setStatus\('archive'/],
  ['Archive GitHub admin link', /github\.com\/ppodolske\/archive/],
  ['Archive Railway admin link', /2bc0b4e2-ca87-4b74-94ff-828b9160444a/],
  ['v0.4.0 release marker', /VERSION='0\.4\.0'/],
];

let failed=false;
for(const [label,pattern] of checks){
  if(!pattern.test(source)){
    failed=true;
    console.error(`FAIL: ${label}`);
  }
}
if(failed) process.exit(1);
console.log('Preston.run Archive integration smoke test passed.');
