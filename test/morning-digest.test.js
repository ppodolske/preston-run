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

const healthy=buildMorningDigest({
  ...base,
  recovery:{date:'2026-09-13',sleepHours:7.4,sleepScore:85,restingHeartRate:50,hrvLastNightAvg:46,averageStressLevel:20}
},'2026-09-13',now);
assert.equal(healthy.status,'good');
assert.equal(healthy.headline,'Recovery signals look broadly normal.');
assert.match(healthy.bullets.join(' '),/do not show an obvious red flag/i);

const poor=buildMorningDigest({
  ...base,
  recovery:{date:'2026-09-13',sleepHours:5.0,sleepScore:45,restingHeartRate:57,hrvLastNightAvg:34,averageStressLevel:35}
},'2026-09-13',now);
assert.equal(poor.status,'poor');
assert.equal(poor.headline,'Recovery is meaningfully suppressed this morning.');
assert.match(poor.bullets.join(' '),/Sleep was very short/i);
assert.match(poor.bullets.join(' '),/Sleep score was 45/i);

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
assert.deepEqual(withContext.cards.map(card=>card.id),['recovery','training','weight','context']);
assert.equal(withContext.date,'2026-09-13');
assert.equal(withContext.generatedAt,now.toISOString());
assert.equal(withContext.sourceGeneratedAt,base.generatedAt);
assert.equal(withContext.garminSyncAt,base.garminSyncAt);
assert.equal(withContext.schemaVersion,1);

console.log('morning digest tests passed');
