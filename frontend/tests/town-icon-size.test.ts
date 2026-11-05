import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createElement,type ReactElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {BLUEPRINTS} from '../../server/src/town-building/game.ts';

type Component=(props?:Record<string,unknown>)=>ReactElement;
type IconCase = {name:string;render:()=>ReactElement;requiresTownIcon?:boolean};
let vite:Awaited<ReturnType<typeof createServer>>;
before(async()=>{
    vite=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),plugins:[react()],server:{middlewareMode:true,hmr:false,ws:false,watch:null},optimizeDeps:{noDiscovery:true}});
});
after(async()=>{await vite.close();});

// Keep this explicit list beside the guard: every exported Town *Icon/*Art
// component must either use the common class or an existing measured art class.
test('Town icon components always carry a measurable display class',async()=>{
    const barn=await vite.ssrLoadModule('/src/features/town-building/BarnUi.tsx') as Record<string,Component>;
    const poultry=await vite.ssrLoadModule('/src/features/town-building/PoultryUi.tsx') as Record<string,Component>;
    const action=await vite.ssrLoadModule('/src/features/town-building/TownActionIcons.tsx') as Record<string,Component>;
    const townArt=await vite.ssrLoadModule('/src/features/town-building/TownArt.tsx') as Record<string,Component>;
    const lantern=await vite.ssrLoadModule('/src/features/town-building/lanternArt.tsx') as Record<string,Component>;
    const river=await vite.ssrLoadModule('/src/features/town-building/riverArt.tsx') as Record<string,Component>;
    const lake=await vite.ssrLoadModule('/src/features/town-building/maps/lake/LakeArt.tsx') as Record<string,Component>;
    const element=(module:Record<string,Component>,name:string,props:Record<string,unknown>={})=>createElement(module[name]!,props);
    const icons:readonly IconCase[]=[
        ...(['MilkIcon','WoolIcon','YarnIcon','FeedIcon','StorageIcon'].map(name=>({name,render:()=>element(barn,name),requiresTownIcon:true}))),
        {name:'EggIcon',render:()=>element(poultry,'EggIcon'),requiresTownIcon:true},
        ...(['BuildToolsIcon','CloseIcon','LockIcon','MoveIcon','RotateIcon','DemolishIcon','RemoveRoadIcon','RemoveRoadNetworkIcon','RemoveFenceIcon','RemoveFenceNetworkIcon','AnimalHeadIcon','WrapFenceIcon','HarvestIcon','ChooseCropIcon'].map(name=>({name,render:()=>element(action,name),requiresTownIcon:true}))),
        {name:'TownBadgeArt',render:()=>element(townArt,'TownBadgeArt',{index:0})},
        {name:'BlueprintArt',render:()=>element(townArt,'BlueprintArt',{blueprint:BLUEPRINTS[0]!})},
        {name:'MaterialArt',render:()=>element(townArt,'MaterialArt',{material:'wood'})},
        {name:'AnimalArt',render:()=>element(townArt,'AnimalArt',{species:'chicken'})},
        {name:'LanternArt',render:()=>element(lantern,'LanternArt')},
        {name:'RiverArt',render:()=>element(river,'RiverArt',{index:0})},
        {name:'GiftArt',render:()=>element(river,'GiftArt',{index:0})},
        {name:'RiverItemArt',render:()=>element(river,'RiverItemArt',{kind:'egg',itemId:'egg'})},
        {name:'FilledBasketArt',render:()=>element(river,'FilledBasketArt',{decoration:'flowers'})},
        {name:'LakeArt',render:()=>element(lake,'LakeArt',{index:0})},
        {name:'LakePlantIcon',render:()=>element(lake,'LakePlantIcon',{plant:'soft-rush'})},
        {name:'LakeStageArt',render:()=>element(lake,'LakeStageArt',{stage:0})},
    ];
    for(const icon of icons){
        const markup=renderToStaticMarkup(icon.render());
        const hasSizingClass=/class="[^"]*\b(?:town-icon|town-river-art|fishing-(?:catch|prop)-art|town-sprite|lake-art|lake-stage|town-material-icon)\b[^"]*"/.test(markup);
        const hasExplicitDimensions=/<(?:svg|img)\b(?=[^>]*\bwidth=)(?=[^>]*\bheight=)[^>]*>/s.test(markup);
        assert.ok(hasSizingClass||hasExplicitDimensions,`${icon.name} rendered without a sizing class or explicit width+height: ${markup}`);
        if(icon.requiresTownIcon)assert.match(markup,/class="[^"]*\btown-icon\b/,`${icon.name} must use the common .town-icon class`);
    }
});
