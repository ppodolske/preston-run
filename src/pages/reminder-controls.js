const {resolveOffsets}=require('../domain/reminders');

function esc(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function reminderClassForLifeItem(item={}){if(['renewal','subscription','membership'].includes(item.category))return'renewal';if(['appointment','event'].includes(item.category))return'appointment';return'deadline';}
function renderReminderControls({reminderClass,settings={},override=null,edit=false}={}){
  if(!edit||!reminderClass)return'';
  const inherited=resolveOffsets(reminderClass,settings,null),custom=override&&override.enabled===true,current=custom?resolveOffsets(reminderClass,settings,override):inherited;
  return `<div class="field reminder-controls"><label>Reminders</label><select name="reminder_mode"><option value="global" ${custom?'':'selected'}>Use global defaults</option><option value="custom" ${custom?'selected':''}>Custom reminders</option></select><small>Global default: ${esc(inherited.join(', '))} days before</small></div><div class="field"><label>Reminder days before</label><input name="reminder_offsets" value="${esc(current.join(', '))}" inputmode="numeric" autocomplete="off"><small>Comma-separated days before the date. Use 0 for day-of.</small></div>${custom?'<div class="actions"><button class="button" type="submit" name="reminder_action" value="restore">Restore defaults</button></div>':''}`;
}
module.exports={renderReminderControls,reminderClassForLifeItem};
