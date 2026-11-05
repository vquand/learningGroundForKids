/** Shared selectors for the one map building panel: icon tabs choose a group, then only that group's blueprints show. */
export async function showBlueprint(page:any,name:string|RegExp){
  const target=page.locator('.town-blueprints').getByRole('button',{name}).first();
  const tabs=page.locator('.town-group-tabs button:not(.town-book-tab)');
  const count=await tabs.count();
  for(let t=-1;t<count;t++){
    if(t>=0)await tabs.nth(t).click();
    for(let p=0;p<8;p++){
      if(await target.isVisible())return target;
      const next=page.locator('.town-pagination').getByRole('button',{name:'Next',exact:true});
      if(!(await next.count())||!(await next.isEnabled()))break;
      await next.click();
    }
  }
  throw new Error(`Blueprint not found in any group: ${String(name)}`);
}
/** Choose (or, when already selected, toggle) a blueprint wherever its group puts it. */
export async function pickBlueprint(page:any,name:string|RegExp){await (await showBlueprint(page,name)).click();}
