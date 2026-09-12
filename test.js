const {spawnSync}=require('node:child_process');
const files=['test/config.test.js','test/cookies.test.js','test/supabase-adapter.test.js','test/auth-guard.test.js','test/pages.test.js','test/routes.test.js','test/pwa.test.js','test/smoke.test.js'];
for(const file of files){const result=spawnSync(process.execPath,[file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}console.log('preston.ai v0.5.0 test suite passed');
