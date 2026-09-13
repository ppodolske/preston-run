const assert=require('node:assert/strict');
const {buildMorningDigest}=require('../src/domain/morning-digest');

const now=new Date('2026-09-12T22:15:00Z'); // 08:15 Sep 13 Sydney
const base={
  schemaVersion:1,
  generatedAt:'2026-09-12T22:10:00Z',
  garminSyncAt:'2026-09-12T21:55:00Z',
  recovery:null,
  baseline:{days:14,sleepHours:7.1,restingHeartRate:50,hrv:45,averageStressLevel:22},
  weightTrend:null,
  recentTraining:{sessions:0,runs:0,lifts:0,distanceKm:0},
  phase:null,
  intervention:null,
  plannedWorkouts:[],
  actualActivities:[]
};

const insufficient=buildMorningDigest({...base},'2026-09-13',now);
assert.equal(insufficient.status,'insufficient');
assert.equal(insufficient.headline,'Today’s recovery data has not arrived yet.');
assert.match(insufficient.bullets.join(' '),/No planned workout is scheduled for today/);
assert.deepEqual(insufficient.insights.find(x=>x.type==='training_today'),{
  type:'training_today',label:"Today's training",value:'No workout planned',state:'neutral'
});

const healthy=buildMorningDigest({
  ...base,
  recovery:{date:'2026-09-13',sleepHours:7.4,sleepScore:85,restingHeartRate:50,hrvLastNightAvg:46,averageStressLevel:20}
},'2026-09-13',now);
assert.equal(healthy.status,'good');
assert.equal(healthy.headline,'Recovery signals look broadly normal.');
assert.match(healthy.bullets.join(' '),/do not show an obvious red flag/i);
assert.deepEqual(healthy.insights.find(x=>x.type==='recovery_summary'),{
  type:'recovery_summary',label:'Recovery',value:'No obvious red flags',detail:'Sleep, HRV and resting HR are broadly in line with recent history',state:'good'
});

const poor=buildMorningDigest({
  ...base,
  recovery:{date:'2026-09-13',sleepHours:5.0,sleepScore:45,restingHeartRate:57,hrvLastNightAvg:34,averageStressLevel:35}
},'2026-09-13',now);
assert.equal(poor.status,'poor');
assert.equal(poor.headline,'Recovery is meaningfully suppressed this morning.');
assert.match(poor.bullets.join(' '),/Sleep was very short/i);
assert.match(poor.bullets.join(' '),/Sleep score was 45/i);
assert.deepEqual(poor.insights.find(x=>x.type==='sleep_duration'),{
  type:'sleep_duration',label:'Sleep',value:'Very short · 5h 0m',state:'poor'
});
assert.deepEqual(poor.insights.find(x=>x.type==='sleep_score'),{
  type:'sleep_score',label:'Sleep score',value:'45 · Poor',state:'poor'
});
assert.deepEqual(poor.insights.find(x=>x.type==='rhr_delta'),{
  type:'rhr_delta',label:'Resting HR',value:'+7 bpm vs baseline',state:'poor'
});
assert.deepEqual(poor.insights.find(x=>x.type==='hrv_delta'),{
  type:'hrv_delta',label:'HRV',value:'−24% vs baseline',state:'poor'
});

const hrvWatch=buildMorningDigest({
  ...base,
  recovery:{date:'2026-09-13',sleepHours:7.0,sleepScore:80,restingHeartRate:50,hrvLastNightAvg:39,averageStressLevel:22}
},'2026-09-13',now);
assert.deepEqual(hrvWatch.insights.find(x=>x.type==='hrv_delta'),{
  type:'hrv_delta',label:'HRV',value:'−13% vs baseline',state:'watch'
});

const withContext=buildMorningDigest({
  ...base,
  recovery:{date:'2026-09-13',sleepHours:7.2,sleepScore:82,restingHeartRate:50,hrvLastNightAvg:45,averageStressLevel:21},
  plannedWorkouts:[{id:'w1',date:'2026-09-13',name:'Workout A',sport:'strength'}],
  weightTrend:{change:-0.8,recentAvg:121.7,count:12,unit:'kg'},
  recentTraining:{sessions:4,runs:2,lifts:2,distanceKm:14.5},
  phase:{id:'p1',name:'Base',goal:'Build consistency'},
  intervention:{id:'i1',date:'2026-09-10',label:'Earlier bedtime',type:'sleep'}
},'2026-09-13',now);
assert.equal(withContext.status,'good');
assert.match(withContext.bullets.join(' '),/Today’s plan is Workout A/i);
assert.match(withContext.bullets.join(' '),/28-day weight trend is down/i);
assert.match(withContext.bullets.join(' '),/Last 7 days: 4 sessions/i);
assert.deepEqual(withContext.insights.find(x=>x.type==='training_today'),{
  type:'training_today',label:"Today's training",value:'Workout A',detail:'Recovery does not currently suggest a need to change it.',state:'good'
});
assert.deepEqual(withContext.insights.find(x=>x.type==='weight_trend'),{
  type:'weight_trend',label:'28-day weight trend',value:'Down · -0.8 kg',detail:'Between early and recent averages',state:'good'
});
assert.deepEqual(withContext.insights.find(x=>x.type==='training_7d'),{
  type:'training_7d',label:'Last 7 days',value:'4 sessions',detail:'2 runs · 2 lifts · 14.5 km running',state:'neutral'
});
assert.deepEqual(withContext.insights.find(x=>x.type==='active_phase'),{
  type:'active_phase',label:'Active phase',value:'Base — Build consistency',state:'neutral'
});
assert.deepEqual(withContext.insights.find(x=>x.type==='recent_intervention'),{
  type:'recent_intervention',label:'Recent intervention',value:'Earlier bedtime · 2026-09-10',state:'neutral'
});
assert.deepEqual(withContext.cards.map(card=>card.id),['recovery','training','weight','context']);
assert.equal(withContext.date,'2026-09-13');
assert.equal(withContext.generatedAt,now.toISOString());
assert.equal(withContext.sourceGeneratedAt,base.generatedAt);
assert.equal(withContext.garminSyncAt,base.garminSyncAt);
assert.equal(withContext.schemaVersion,1);

console.log('morning digest tests passed');
