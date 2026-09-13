const {DEFAULT_REMINDER_OFFSETS,resolveOffsets}=require('../domain/reminders');

function esc(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function renderReminderControls({reminderClass,settings={},override=null,edit=false}={}){
  if(!edit||!reminderClass)return'';
  const inherited=resolveOffsets(reminderClass,settings,null);
  const custom=override&&override.enabled===true;
  const current=custom?resolveOffsets(reminderClass,settings,override):inherited;
  return `<div class="field reminder-controls"><label>Reminders</label><select name="reminder_mode"><option value="global" ${custom?'':'selected'}>Use global defaults</option><option value="custom" ${custom?'selected':''}>Custom reminders</option></select><small>Global default: ${esc(inherited.join(', '))} days before</small></div><div class="field"><label>Reminder days before</label><input name="reminder_offsets" value="${esc(current.join(', '))}" inputmode="numeric" autocomplete="off"><small>Comma-separated days before the date.</small></div>${custom?'<div class="actions"><button class="button" type="submit" name="reminder_action" value="restore">Restore defaults</button></div>':''}`;
}

module.exports={renderReminderControls};
