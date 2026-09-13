'use strict';

function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function fmt(v,d=0){return v===null||v===undefined||!Number.isFinite(Number(v))?'—':Number(v).toFixed(d);}
function sleepText(h){if(h===null)return '—';const hr=Math.floor(h),min=Math.round((h-hr)*60);return `${hr}h ${min}m`;}
function pctDiff(v,b){return v!==null&&b!==null&&b!==0?((v-b)/b)*100:null;}

function recoveryValues(context){
  const rec=context?.recovery||null;
  return {
    rec,
    sleep:num(rec?.sleepHours),
    score:num(rec?.sleepScore),
    rhr:num(rec?.restingHeartRate),
    hrv:num(rec?.hrvLastNightAvg??rec?.hrv),
    stress:num(rec?.averageStressLevel)
  };
}

function planSummary(context,dateKey){
  const plans=(Array.isArray(context?.plannedWorkouts)?context.plannedWorkouts:[]).filter(x=>x?.date===dateKey);
  return plans.length
    ?{count:plans.length,text:plans.map(p=>p.name||p.sport||'Planned workout').join(' + '),plans}
    :{count:0,text:'No workout planned',plans:[]};
}

function buildFlags({sleep,score,rhr,hrv,stress},baseline={}){
  const flags=[];
  if(sleep!==null){
    if(sleep<5.5)flags.push({level:2,text:`Sleep was very short at ${sleepText(sleep)}.`});
    else if(sleep<6.5)flags.push({level:1,text:`Sleep was short at ${sleepText(sleep)}.`});
  }
  if(score!==null){
    if(score<50)flags.push({level:2,text:`Sleep score was ${fmt(score)}.`});
    else if(score<70)flags.push({level:1,text:`Sleep score was ${fmt(score)}.`});
  }
  const baseRhr=num(baseline.restingHeartRate),rhrDelta=rhr!==null&&baseRhr!==null?rhr-baseRhr:null;
  if(rhrDelta!==null){
    if(rhrDelta>=6)flags.push({level:2,text:`Resting HR is ${fmt(rhrDelta)} bpm above the recent baseline.`});
    else if(rhrDelta>=3)flags.push({level:1,text:`Resting HR is ${fmt(rhrDelta)} bpm above the recent baseline.`});
  }
  const baseHrv=num(baseline.hrv),hrvPct=pctDiff(hrv,baseHrv);
  if(hrvPct!==null){
    if(hrvPct<=-20)flags.push({level:2,text:`HRV is ${fmt(Math.abs(hrvPct))}% below the recent baseline.`});
    else if(hrvPct<=-10)flags.push({level:1,text:`HRV is ${fmt(Math.abs(hrvPct))}% below the recent baseline.`});
  }
  const baseStress=num(baseline.averageStressLevel);
  if(stress!==null&&baseStress!==null&&stress-baseStress>=10)flags.push({level:1,text:'Recent stress is elevated versus baseline.'});
  return flags;
}

function statusFrom(rec,flags){
  const severe=flags.filter(f=>f.level===2).length,watch=flags.filter(f=>f.level===1).length;
  if(!rec)return{status:'insufficient',headline:'Today’s recovery data has not arrived yet.'};
  if(severe>=2||(severe>=1&&watch>=1))return{status:'poor',headline:'Recovery is meaningfully suppressed this morning.'};
  if(severe||watch>=2)return{status:'watch',headline:'Recovery has a few watch signals this morning.'};
  return{status:'good',headline:'Recovery signals look broadly normal.'};
}

function buildCards(context,dateKey,status,values,plan){
  const cards=[];
  const baseline=context?.baseline||{};
  cards.push({
    id:'recovery',title:'Recovery',status,
    items:[
      {label:'Sleep',value:values.sleep===null?'—':sleepText(values.sleep)},
      {label:'Sleep score',value:values.score===null?'—':fmt(values.score)},
      {label:'Resting HR',value:values.rhr===null?'—':`${fmt(values.rhr)} bpm`},
      {label:'HRV',value:values.hrv===null?'—':fmt(values.hrv)},
      {label:'14-day sleep baseline',value:num(baseline.sleepHours)===null?'—':sleepText(num(baseline.sleepHours))}
    ]
  });

  const training=context?.recentTraining||{};
  if(plan.count||num(training.sessions)!==null){
    cards.push({
      id:'training',title:'Training',
      items:[
        {label:'Today',value:plan.count?plan.text:'No workout planned'},
        {label:'Last 7 days',value:`${num(training.sessions)??0} sessions`},
        {label:'Runs',value:String(num(training.runs)??0)},
        {label:'Lifts',value:String(num(training.lifts)??0)},
        {label:'Running distance',value:(num(training.distanceKm)||0)?`${fmt(training.distanceKm,1)} km`:'0 km'}
      ]
    });
  }

  const weights=context?.weightTrend||null;
  if(weights){
    const change=num(weights.change),unit=weights.unit||'kg';
    cards.push({
      id:'weight',title:'Weight trend',
      items:[
        {label:'28-day direction',value:change===null?'—':change<-.15?'Down':change>.15?'Up':'Stable'},
        {label:'Change',value:change===null?'—':`${change>0?'+':''}${fmt(change,1)} ${unit}`},
        {label:'Recent average',value:num(weights.recentAvg)===null?'—':`${fmt(weights.recentAvg,1)} ${unit}`}
      ]
    });
  }

  const phase=context?.phase||null,intervention=context?.intervention||null;
  if(phase||intervention){
    const items=[];
    if(phase)items.push({label:'Active phase',value:`${phase.name||'Unnamed phase'}${phase.goal?` — ${phase.goal}`:''}`});
    if(intervention)items.push({label:'Recent intervention',value:`${intervention.label||intervention.type||'Logged change'}${intervention.date?` · ${intervention.date}`:''}`});
    cards.push({id:'context',title:'Context',items});
  }
  return cards;
}

function buildMorningDigest(context={},dateKey,now=new Date()){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey||'')))throw new Error('Digest date is required');
  if(!(now instanceof Date)||Number.isNaN(now.getTime()))throw new Error('Digest generation time is invalid');
  const values=recoveryValues(context),baseline=context.baseline||{},plan=planSummary(context,dateKey);
  const flags=buildFlags(values,baseline),state=statusFrom(values.rec,flags),bullets=[];
  if(flags.length)bullets.push(...flags.slice(0,3).map(f=>f.text));
  else if(values.rec)bullets.push('Sleep, HRV and resting-heart-rate signals do not show an obvious red flag versus recent history.');

  if(plan.count){
    bullets.push(state.status==='poor'
      ?`Today’s plan is ${plan.text}. Consider keeping the session flexible rather than forcing target intensity.`
      :state.status==='watch'
        ?`Today’s plan is ${plan.text}. The session is reasonable, but recovery signals support using effort as the ceiling.`
        :`Today’s plan is ${plan.text}. Recovery does not currently suggest a need to change it.`);
  }else bullets.push('No planned workout is scheduled for today.');

  const weights=context.weightTrend||null;
  if(weights){
    const change=num(weights.change),unit=weights.unit||'kg',dir=change!==null&&change<-.15?'down':change!==null&&change>.15?'up':'stable';
    bullets.push(`28-day weight trend is ${dir}${change!==null&&Math.abs(change)>=.15?` (${change>0?'+':''}${fmt(change,1)} ${unit} between early and recent averages)`:''}.`);
  }
  const training=context.recentTraining||{};
  if((num(training.sessions)||0)>0)bullets.push(`Last 7 days: ${fmt(training.sessions)} sessions (${fmt(training.runs||0)} runs, ${fmt(training.lifts||0)} lifts${num(training.distanceKm)?`, ${fmt(training.distanceKm,1)} km running`:''}).`);
  if(context.phase)bullets.push(`Active phase: ${context.phase.name||'Unnamed phase'}${context.phase.goal?` — ${context.phase.goal}`:''}.`);
  if(context.intervention)bullets.push(`Recent intervention: ${context.intervention.label||context.intervention.type||'Logged change'} (${context.intervention.date}).`);

  return {
    schemaVersion:1,
    date:String(dateKey),
    status:state.status,
    headline:state.headline,
    cards:buildCards(context,dateKey,state.status,values,plan),
    bullets:bullets.slice(0,6),
    generatedAt:now.toISOString(),
    sourceGeneratedAt:context.generatedAt||null,
    garminSyncAt:context.garminSyncAt||null
  };
}

module.exports={buildMorningDigest};
