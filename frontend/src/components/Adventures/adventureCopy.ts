import { uiMessage,uiText } from '../../i18n/uiText';
import type { AdventureEntry } from '../../api/adventures';
const templates:Record<AdventureEntry['kind'],string>={
  explore_learned:'Learned about {subject}',meal_finished:'Finished making {subject}',meal_burnt:'Burnt {subject} — another try awaits!',meal_undercooked:'Tried {subject} — a little more cooking next time!',
  blueprint_unlocked:'Unlocked the {subject} blueprint',town_built:'Built {subject}',town_milestone:'Reached a town milestone: {subject}',town_harvest:'Harvested {amount} vegetables',
  ufo_solved:'Solved the word {subject}',waddle_passed:'Passed a Waddle Wall — {amount} points',drill_depth:'Dug down to {amount} metres',drill_core:'Reached Earth’s core!',drill_upgrade:'Discovered the {subject} drill upgrade',miniku_completed:'Completed a {amount} × {amount} Miniku puzzle',
};
const groupedTemplates:Partial<Record<AdventureEntry['kind'],string>>={
  explore_learned:'Learned about {count} things',
  meal_finished:'Finished {count} batches of {subject}',
  meal_burnt:'Burnt {count} batches of {subject} — another try awaits!',
  meal_undercooked:'Tried {count} batches of {subject} — a little more cooking next time!',
  blueprint_unlocked:'Unlocked {count} blueprints',
  town_built:'Built {count} × {subject}',
  town_milestone:'Reached {count} town milestones',
  ufo_solved:'Solved {count} words',
  waddle_passed:'Passed {count} Waddle Walls — best {amount} points',
  drill_depth:'Reached {amount} metres across {count} digging milestones',
  drill_core:'Reached Earth’s core {count} times!',
  drill_upgrade:'Discovered {count} drill upgrades',
  miniku_completed:'Completed {count} puzzles of {amount} × {amount}',
};
export function adventureCopy(entry:AdventureEntry):string{
  const subject=entry.kind==='explore_learned'||entry.kind==='ufo_solved'?entry.data.subject??'':uiText(entry.data.subject??'');
  const count=Number.isSafeInteger(entry.count)&&entry.count!>0?entry.count!:1;
  if(count>1&&entry.kind==='town_built'&&entry.data.subject==='Rocky road')return uiMessage('Built {count} rocky roads',{count});
  if(count>1&&entry.kind==='town_built'&&entry.data.subject==='Dirt road')return uiMessage('Built {count} dirt roads',{count});
  const template=count>1?(groupedTemplates[entry.kind]??templates[entry.kind]):templates[entry.kind];
  return uiMessage(template??'A new adventure',{subject,amount:entry.data.amount??0,count});
}
