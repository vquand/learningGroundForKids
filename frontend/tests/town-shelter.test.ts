import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimalMoments,type MomentWorld} from '../src/features/town-building/animalMoments.ts';
import {createAnimalResidents} from '../src/features/town-building/animalWorld.ts';
import {SHELTER_VIEWS,shelterArtBounds,shelterSlot,shelteredHostIds} from '../src/features/town-building/shelterInterior.ts';
import {entityDoorPoint,entityFootprint,type Entity} from '../../server/src/town-building/game.ts';
import {townImageFiles} from '../src/features/town-building/townImageFiles.ts';
import {buildingView} from '../src/features/town-building/buildingViews.ts';
import {animalSprite} from '../src/features/town-building/animalSprite.ts';
import {drawTownBuilding} from '../src/features/town-building/buildingRender.ts';
import type {Environment} from '../../server/src/town-building/environment.ts';
import type {TownOccluder} from '../src/features/town-building/halloweenDepth.ts';
import {freshCivHome} from '../../server/src/town-building/civCatalog.ts';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

const HAVEN_VIEWS=SHELTER_VIEWS['animal-habitat']!;
const host=(animal:Entity['animal']='capybara',direction?:Entity['direction']):Entity=>({id:'haven',blueprintId:'animal-habitat',animal,direction,x:4,y:12,paidCost:{}});
const barn=(direction:Entity['direction']='front',animal:Entity['animal']='dairy-cow'):Entity=>({id:'barn',blueprintId:'farmhouse',animal,direction,x:4,y:12,paidCost:{}});
const DIRECTIONS=['front','left','right','back'] as const;
const world=(h:Entity):MomentWorld=>({mapId:'town',entities:[h],rafts:[],weather:{precipitation:'none',season:'spring',timeOfDay:'night',isDay:false},now:0,growthSeconds:0});
const setup=(h:Entity)=>{const animals=createAnimalResidents([h],[],{mapId:'town'});for(const a of animals)Object.assign(a,{x:a.shelter.x,y:a.shelter.y,path:[],mode:'resting',sleeping:true});return animals;};

test('resident and shop boards register their owner for the shelter depth exception',()=>{
    for(const blueprintId of ['animal-habitat','farmhouse','coop','grocery'] as const)for(const direction of DIRECTIONS){
        const h:Entity={id:`${blueprintId}-${direction}`,blueprintId,direction,x:4,y:12,paidCost:{},...(blueprintId==='grocery'?{civ:{...freshCivHome(),phase:'ready' as const}}:{animal:blueprintId==='coop'?'goose':blueprintId==='farmhouse'?'pig':'rabbit'})};
        const images=new Map(townImageFiles([h]).map(file=>[file,{complete:true,naturalWidth:1536} as HTMLImageElement]));
        const ctx={drawImage(){}} as unknown as CanvasRenderingContext2D,occluders:TownOccluder[]=[];
        drawTownBuilding(ctx,images,h,{season:'spring',timeOfDay:'noon',isDay:true,precipitation:'none'} as Environment,100,17,23,[h],occluders);
        const boards=occluders.filter(o=>o.image===images.get('animalSign'));
        assert.equal(boards.length,1,`${blueprintId} ${direction} registers its board`);
        assert.equal(boards[0]!.interiorOnly,true,'own shelter residents use the special board depth');
        assert.equal(boards[0]!.ownerId,h.id);
    }
});

test('signposts mask outdoor animals behind them, preserve walkers in front and the own-shelter exception',async()=>{
    const {AnimalDepthLayer}=await import('../src/features/town-building/animalDepth.ts');
    const previous=Object.getOwnPropertyDescriptor(globalThis,'document'),masked:unknown[]=[];
    const work={globalCompositeOperation:'source-over',setTransform(){},clearRect(){},drawImage(image:unknown){if(this.globalCompositeOperation==='destination-out')masked.push(image);}};
    Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>work})}});
    try{
        const layer=new AnimalDepthLayer(),image={} as HTMLImageElement,sign={image,crop:[0,0,10,10],x:0,y:0,width:10,height:10,depth:6.1,ownerId:'barn',interiorOnly:true};
        const bounds={x:0,y:0,width:10,height:10},ctx={drawImage(){}} as unknown as CanvasRenderingContext2D;
        for(const depth of [4,6,6.05]){masked.length=0;layer.draw(ctx,depth,bounds,[sign],()=>{});assert.deepEqual(masked,[image],`outdoor animal at ${depth} behind the board`);}
        masked.length=0;layer.draw(ctx,6.2,bounds,[sign],()=>{});assert.deepEqual(masked,[],'walker in front remains visible');
        masked.length=0;layer.draw(ctx,6.2,bounds,[sign],()=>{},1,{...sign,ownerId:'barn'});assert.deepEqual(masked,[image],'own shelter resident stays behind its board even at the doorstep');
        masked.length=0;layer.draw(ctx,6.2,bounds,[sign],()=>{},1,{...sign,ownerId:'other'});assert.deepEqual(masked,[],'another shelter uses ordinary depth');
    }finally{if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');}
});

test('outdoor sheep and ducks retain building/signpost depth even while peeking out of crops',async()=>{
    const server=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),plugins:[react()],server:{middlewareMode:true,hmr:false,ws:false,watch:null},optimizeDeps:{noDiscovery:true}});
    const previous=Object.getOwnPropertyDescriptor(globalThis,'devicePixelRatio');
    Object.defineProperty(globalThis,'devicePixelRatio',{configurable:true,value:1});
    try{
        const {drawAnimalResidents}=await server.ssrLoadModule('/src/features/town-building/animalRender.ts');
        for(const mapId of ['town','lake'] as const)for(const species of ['sheep','duck'] as const)for(const peek of [undefined,.5]){
            const h={...barn('front',species==='sheep'?'sheep':undefined),blueprintId:species==='duck'?'coop':'farmhouse',animal:species};
            const animal=createAnimalResidents([h],[],{mapId})[0]!;
            Object.assign(animal,{mode:'roaming',sleeping:false,x:10,y:2,path:[],pause:1});
            const sprite=animalSprite(species,animal),images=new Map([[sprite.file,{complete:true,naturalWidth:1536} as HTMLImageElement]]);
            const ctx=new Proxy({},{get:()=>()=>{},set:()=>true}) as CanvasRenderingContext2D;let masked=0;
            const depth={draw(_ctx:CanvasRenderingContext2D,_at:number,_bounds:unknown,_occluders:unknown,paint:(work:CanvasRenderingContext2D)=>void){masked++;paint(ctx);}} as unknown as import('../src/features/town-building/animalDepth.ts').AnimalDepthLayer;
            drawAnimalResidents(ctx,images,[{...animal,peek}],{season:'spring',precipitation:'none'} as Environment,{tile:40,ox:0,oy:0,width:1000,height:600,zoom:1,time:0,reducedMotion:true,occluders:[],depth,vegetation:[]});
            assert.equal(masked,1,`${mapId} ${species} peek ${peek}: the shared depth path always applies`);
        }
    }finally{await server.close();if(previous)Object.defineProperty(globalThis,'devicePixelRatio',previous);else Reflect.deleteProperty(globalThis,'devicePixelRatio');}
});

test('front havens assign two side-by-side capybaras and four rabbits in stable 2x2 slots',()=>{
    for(const species of ['capybara','rabbit'] as const){
        const h=host(species),animals=setup(h),moments=new AnimalMoments(),w=world(h);
        moments.step(animals,w,.05,false);const shows=moments.decorate([...animals].reverse(),w).sort((a,b)=>a.ordinal-b.ordinal);
        assert.equal(shows.length,species==='capybara'?2:4);assert.ok(shows.every(a=>a.haven&&a.sleeping&&a.housing==='open'&&!a.path.length));
        assert.equal(new Set(shows.map(a=>a.y)).size,2);assert.equal(new Set(shows.map(a=>a.x)).size,species==='capybara'?1:2);
        for(const a of shows){const slot=shelterSlot(h,a.species,a.ordinal)!;assert.equal(a.x,slot.x);assert.equal(a.y,slot.y);}
        assert.ok(animals.every(a=>a.x===a.shelter.x&&a.y===a.shelter.y),'simulation stays at its own shelter');
    }
});
test('turned havens expose one capybara or two rabbits and keep every other resident unseen inside',()=>{
    for(const mapId of ['town','lake'] as const)for(const direction of ['left','back','right'] as const)for(const species of ['capybara','rabbit'] as const){
        const h=host(species,direction),animals=setup(h),m=new AnimalMoments(),w={...world(h),mapId};
        for(const a of animals)a.mapId=mapId;m.step(animals,w,.05,false);
        const shows=m.decorate([...animals].reverse(),w).sort((a,b)=>a.ordinal-b.ordinal);
        assert.equal(shows.length,species==='capybara'?1:2);assert.ok(shows.every(a=>a.haven&&a.sleeping===(species==='capybara')&&a.housing==='open'&&a.direction==='side'),'capybaras sleep; rabbits sit up so their ears show');
        for(const a of shows){const slot=shelterSlot(h,species,a.ordinal)!;assert.equal(a.x,slot.x);assert.equal(a.y,slot.y);assert.ok(Math.abs(a.scale!-slot.scale)<1e-12);assert.equal(a.facing,slot.facing);}
        for(let ordinal=shows.length;ordinal<animals.length;ordinal++){assert.equal(shelterSlot(h,species,ordinal),null);assert.ok(!shows.some(a=>a.ordinal===ordinal));}
        assert.equal(animals.length,species==='capybara'?2:4);assert.ok(animals.every(a=>a.x===a.shelter.x&&a.y===a.shelter.y),'simulation and population are unchanged');
        for(const a of animals){a.mode='roaming';a.sleeping=false;}m.step(animals,w,.4,false);assert.equal(m.decorate(animals,w).length,animals.length,'all residents reappear after waking');
    }
});
test('other buildings, unsupported species and distant naps do not use haven slots',()=>{
    for(const blueprintId of ['house','coop'])assert.equal(shelterSlot({...host(),blueprintId},'capybara',0),null);
    assert.equal(shelterSlot(host(),'chicken',0),null);assert.equal(shelterSlot(host(),'rabbit',4),null);
    const h=host(),animals=setup(h),m=new AnimalMoments(),w=world(h);for(const a of animals){a.mode='roaming';a.x+=2;}m.step(animals,w,.05,false);assert.ok(m.decorate(animals,w).every(a=>!a.haven));
});
test('turned windows show only the top of full-size residents (ears, upper back) without changing artwork proportions',()=>{
    const opening={left:[450,860,738,948],right:[286,860,574,948],back:[597,628,939,710]};
    for(const direction of ['left','right','back'] as const){
        const h=host('rabbit',direction),view=HAVEN_VIEWS[direction],c=view.crop,b=shelterArtBounds(h,100,17,23),f=entityFootprint(h),scale=b.width/c[2];
        assert.equal(b.height,c[3]*scale);assert.equal(b.y+b.height,23+(h.x+f.width)*100);assert.equal(b.x+b.width/2,17+(h.y+f.length/2)*100);
        assert.deepEqual(buildingView('animal-habitat',direction),{file:view.closed,crop:view.crop});
        for(const species of ['capybara','rabbit'] as const)for(let ordinal=0;ordinal<view.slots[species]!.length;ordinal++){
            const s=shelterSlot(h,species,ordinal)!,px=c[0]+(17+s.y*100-b.x)/scale,py=c[1]+(23+s.x*100-b.y)/scale;
            const sprite=animalSprite(species,{sleeping:species==='capybara',path:[],pause:1,clock:0,direction:'side',running:false,flying:false,perched:false});
            const width=(species==='capybara'?.9:.78)*s.scale*100/scale,height=width*sprite.crop[3]!/sprite.crop[2]!,o=opening[direction];
            assert.equal(s.scale,species==='capybara'?.82:.62,'the same size as inside the front opening');
            assert.ok(px>o[0]!&&px<o[2]!,`${direction} ${species} sits behind its own window`);
            assert.ok(py>o[3]!&&py-height<o[3]!-20,`${direction} ${species}: the sill hides the body, the top shows through the window`);
        }
    }
});
test('haven image loading includes only layers for installed directions',()=>{
    const empty=townImageFiles([]);assert.ok(!empty.some(file=>file.includes('haven-')&&file!=='habitat'));
    for(const direction of ['front','left','right','back'] as const){
        const files=townImageFiles([host('rabbit',direction)]),v=HAVEN_VIEWS[direction]!;assert.ok(files.includes(v.closed)&&files.includes(v.open)&&files.includes(v.hollow)&&files.includes(v.interior));
        for(const other of DIRECTIONS)if(other!==direction){assert.ok(!files.includes(HAVEN_VIEWS[other]!.hollow));assert.ok(!files.includes(HAVEN_VIEWS[other]!.interior));}
    }
});
test('every haven direction draws the matching interior before its hollow shell with the same source crop',()=>{
    for(const direction of DIRECTIONS){
        const h=host('capybara',direction),v=HAVEN_VIEWS[direction]!,calls:unknown[][]=[],images=new Map([v.closed,v.hollow,v.interior].map(file=>[file,{complete:true,naturalWidth:1536} as HTMLImageElement]));
        const ctx={drawImage(...args:unknown[]){calls.push(args);}} as unknown as CanvasRenderingContext2D;
        drawTownBuilding(ctx,images,h,{season:'spring',timeOfDay:'noon',isDay:true,precipitation:'none'} as Environment,100,17,23,[h]);
        assert.equal(calls.length,2);assert.equal(calls[0]![0],images.get(v.interior));assert.equal(calls[1]![0],images.get(v.hollow));
        assert.deepEqual(calls[0]!.slice(1),calls[1]!.slice(1));assert.deepEqual(calls[0]!.slice(1,5),v.crop);
        const b=shelterArtBounds(h,100,17,23);assert.deepEqual(calls[0]!.slice(5),[b.x,b.y,b.width,b.height]);
    }
});
test('the clip uses the exact building crop transform and slots sit inside its measured opening',()=>{
    const h=host(),b=shelterArtBounds(h,100,17,23),scale=b.width/1023;
    assert.equal(b.x,1217);assert.equal(b.y,623-b.height);assert.equal(b.height,882*scale);
    for(const species of ['capybara','rabbit'] as const)for(let i=0;i<(species==='rabbit'?4:2);i++){const s=shelterSlot(h,species,i)!,x=17+s.y*100,y=23+s.x*100;assert.ok(x>b.x+(425-189)*scale&&x<b.x+(974-189)*scale);assert.ok(y>b.y+(650-127)*scale&&y<b.y+(870-127)*scale);}
});
test('entry and waking reverse the 0.4-second slide, retain sleeping pose until outside, and preserve individual waking order',()=>{
    const h=host('rabbit'),animals=setup(h),m=new AnimalMoments(),w=world(h);
    for(const a of animals){a.mode='returning';a.sleeping=false;}
    m.step(animals,w,.05,false);assert.ok(m.decorate(animals,w).every(a=>!a.haven&&a.housing==='open'),'rabbits no longer fade at the front door');
    for(const a of animals){a.mode='resting';a.sleeping=true;}
    m.step(animals,w,.2,false);let shows=m.decorate(animals,w);assert.equal(shows[0]!.haven!.progress,.5);assert.ok(shows[0]!.x<animals[0]!.x&&shows[0]!.x>shelterSlot(h,'rabbit',0)!.x);
    m.step(animals,w,.2,false);shows=m.decorate(animals,w);assert.equal(shows[0]!.haven!.progress,1);
    animals[0]!.mode='roaming';animals[0]!.sleeping=false;m.step(animals,w,.2,false);shows=m.decorate(animals,w);assert.equal(shows[0]!.haven!.progress,.5);assert.ok(shows[0]!.sleeping);assert.equal(shows[1]!.haven!.progress,1);
    animals[0]!.y+=.12;m.step(animals,w,.2,false);shows=m.decorate(animals,w);assert.equal(shows[0]!.y,animals[0]!.y,'exit rejoins the live sample without snapping back to the door');assert.equal(shows[0]!.haven,undefined);assert.equal(shows[0]!.sleeping,false);assert.ok(shows[1]!.haven);
});
test('asleep within 0.75 tile enters; reduced motion settles without sliding and layout changes discard transitions',()=>{
    const h=host(),animals=setup(h),m=new AnimalMoments(),w=world(h);for(const a of animals){a.mode='roaming';a.sleeping=false;}m.step(animals,w,.05,false);
    animals[0]!.sleeping=true;animals[0]!.x+=.7;m.step(animals,w,.05,true);assert.equal(m.decorate(animals,w)[0]!.haven!.progress,1);
    animals[0]!.sleeping=false;m.step(animals,w,.05,true);assert.equal(m.decorate(animals,w)[0]!.haven,undefined);
    animals[0]!.mode='resting';m.step(animals,w,.2,false);h.direction='left';m.step(animals,w,.05,false);const show=m.decorate(animals,w)[0]!,slot=shelterSlot(h,'capybara',0)!;
    assert.equal(show.haven!.progress,1);assert.equal(show.x,slot.x);assert.equal(show.y,slot.y,'rotation discards the old transition and settles in the new window');
});
test('each turned entrance slides to its slot in 0.4 seconds, reverses individually and settles immediately for reduced motion',()=>{
    for(const direction of ['left','right','back'] as const){
        const h=host('rabbit',direction),animals=setup(h),m=new AnimalMoments(),w=world(h),slot=shelterSlot(h,'rabbit',0)!,door=entityDoorPoint(h);
        for(const a of animals){a.mode='returning';a.sleeping=false;}m.step(animals,w,.05,false);
        for(const a of animals){a.mode='resting';a.sleeping=true;}m.step(animals,w,.2,false);let shows=m.decorate(animals,w);
        assert.equal(shows.length,2);assert.equal(shows[0]!.haven!.progress,.5);assert.equal(shows[0]!.x,door.x+(slot.x-door.x)*.5);assert.equal(shows[0]!.y,door.y+(slot.y-door.y)*.5);
        m.step(animals,w,.2,false);assert.equal(m.decorate(animals,w)[0]!.haven!.progress,1);
        animals[0]!.mode='roaming';animals[0]!.sleeping=false;m.step(animals,w,.2,false);shows=m.decorate(animals,w);assert.equal(shows[0]!.haven!.progress,.5);assert.equal(shows[0]!.sleeping,false,'window rabbits sit up');assert.equal(shows[1]!.haven!.progress,1);
        m.step(animals,w,.05,true);shows=m.decorate(animals,w);assert.equal(shows[0]!.haven,undefined);assert.ok(shows[1]!.haven);
        animals[0]!.mode='resting';m.step(animals,w,.05,true);assert.equal(m.decorate(animals,w)[0]!.haven!.progress,1);
    }
});
test('awake rain-sheltering rabbits use the resting artwork without inventing sleep indicators',()=>{
    const h=host('rabbit'),animals=setup(h),m=new AnimalMoments(),w=world(h);w.weather={...w.weather,timeOfDay:'noon',isDay:true,precipitation:'rain'};
    for(const a of animals)a.sleeping=false;m.step(animals,w,.05,false);
    const shows=m.decorate(animals,w);assert.ok(shows.every(a=>a.sleeping&&a.haven&&!a.haven.asleep));assert.ok(animals.every(a=>!a.sleeping));
});
test('interior tint reuses the same canvas for a tone, while night and rain get their own cached fill',async()=>{
    const {shelterInteriorTint}=await import('../src/features/town-building/shelterInterior.ts');
    const previous=Object.getOwnPropertyDescriptor(globalThis,'document'),fills:string[]=[],work={globalCompositeOperation:'',fillStyle:'',drawImage(){},fillRect(){fills.push(this.fillStyle);}};let allocated=0;
    Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(){allocated++;return {width:0,height:0,getContext:()=>work};}}});
    try{
        const image={naturalWidth:1402,naturalHeight:1122} as HTMLImageElement,environment={...world(host()).weather} as any;
        const night=shelterInteriorTint(image,environment);assert.equal(shelterInteriorTint(image,environment),night);assert.equal(allocated,1);
        const rain=shelterInteriorTint(image,{...environment,precipitation:'rain'});assert.notEqual(rain,night);assert.equal(shelterInteriorTint(image,{...environment,precipitation:'rain'}),rain);assert.equal(allocated,2);
        assert.ok(fills.includes('rgba(22,35,76,.43)')&&fills.includes('rgba(75,102,126,.12)'));assert.equal(work.globalCompositeOperation,'source-atop');
        assert.equal(shelterInteriorTint(image,{...environment,timeOfDay:'noon',isDay:true}),image);assert.equal(allocated,2);
    }finally{if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');}
});
test('the reusable depth layer clips a resident before masking closer scenery, even with no occluders',async()=>{
    const {AnimalDepthLayer}=await import('../src/features/town-building/animalDepth.ts');
    const previous=Object.getOwnPropertyDescriptor(globalThis,'document'),operations:any[]=[],work={globalCompositeOperation:'source-over',setTransform(...args:number[]){operations.push(['transform',...args]);},clearRect(){},drawImage(...args:any[]){operations.push([this.globalCompositeOperation,...args]);}};let allocated=0;
    Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(){allocated++;return {width:0,height:0,getContext:()=>work};}}});
    try{
        const depth=new AnimalDepthLayer(),image={} as HTMLImageElement,clip={...shelterArtBounds(host(),100,17,23),image,crop:[189,127,1023,882],depth:6};
        const ctx={drawImage(){operations.push(['output']);}} as unknown as CanvasRenderingContext2D;
        const paint=()=>operations.push(['animal']),bounds={x:1300,y:500,width:100,height:80};
        depth.draw(ctx,6,bounds,[],paint,2,clip);
        assert.ok(operations.some(o=>o[0]==='destination-in'&&o[1]===image&&o.slice(2,6).join(',')==='189,127,1023,882'),'exact source mask used even without closer scenery');
        assert.ok(operations.some(o=>o.join(',')==='transform,2,0,0,2,-2600,-1000'),'clip and animal share the camera and DPR transform');
        assert.equal(operations[operations.length-1]![0],'output');
        operations.length=0;depth.draw(ctx,6,bounds,[{...clip,depth:7}],paint,2,clip);
        assert.ok(operations.findIndex(o=>o[0]==='destination-in')<operations.findIndex(o=>o[0]==='destination-out'),'closer buildings still overlap the clipped animal');assert.equal(allocated,1);
    }finally{if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');}
});
test('farmhouse bays seat two residents of each barn species facing into the opening in every direction',()=>{
    for(const direction of DIRECTIONS)for(const species of ['dairy-cow','highland-cow','sheep','pig'] as const){
        const h=barn(direction,species),animals=createAnimalResidents([h],[],{mapId:'town'}),view=SHELTER_VIEWS.farmhouse![direction];
        assert.equal(animals.length,2);assert.ok(animals.every(a=>a.species===species));
        for(let ordinal=0;ordinal<2;ordinal++){const s=shelterSlot(h,species,ordinal)!;assert.ok(s,`${direction} ${species} slot ${ordinal}`);assert.equal(s.scale,1,'same size as roaming');assert.equal(s.facing,view.slots[species]![ordinal]![3]);assert.equal(s.sit,false,'bays sleep rather than sit up');}
        assert.equal(shelterSlot(h,species,2),null);assert.equal(shelterSlot(h,'chicken',0),null);
    }
});
test('a barn switches to sheltering art only while a resident rests at home, and an unchanged set keeps its cache key',()=>{
    const h=barn('left'),animals=createAnimalResidents([h],[],{mapId:'town'}),set=new Set<string>();
    for(const a of animals)Object.assign(a,{x:a.shelter.x,y:a.shelter.y,path:[],mode:'resting',sleeping:true});
    assert.deepEqual([...shelteredHostIds(animals,[h],set)],['barn']);assert.equal(shelteredHostIds(animals,[h],set),set);
    for(const a of animals){a.mode='roaming';a.sleeping=false;a.x+=2;}
    assert.equal(shelteredHostIds(animals,[h],set).size,0,'roaming residents leave the closed art in place');
    for(const a of animals){a.mode='roaming';a.sleeping=true;a.x+=2;}
    assert.equal(shelteredHostIds(animals,[h],set).size,0,'a nap far from the barn does not shelter');
    for(const a of animals){a.mode='resting';}
    assert.deepEqual([...shelteredHostIds(animals,[h],set)],['barn'],'resting residents shelter whatever their position');
});
test('a farmhouse draws its closed art until a resident shelters, then the interior and hollow shell over the door-open art',()=>{
    for(const direction of DIRECTIONS){
        const h=barn(direction),v=SHELTER_VIEWS.farmhouse![direction],images=new Map([v.closed,v.open,v.hollow,v.interior].map(file=>[file,{complete:true,naturalWidth:1536} as HTMLImageElement]));
        const environment={season:'spring',timeOfDay:'noon',isDay:true,precipitation:'none'} as Environment;
        const draw=(sheltered:ReadonlySet<string>)=>{const calls:unknown[][]=[];const ctx={drawImage(...args:unknown[]){calls.push(args);}} as unknown as CanvasRenderingContext2D;drawTownBuilding(ctx,images,h,environment,100,17,23,[h],undefined,{sheltered});return calls;};
        const closed=draw(new Set());assert.equal(closed.length,1,`${direction} closed`);assert.equal(closed[0]![0],images.get(v.closed));assert.deepEqual(closed[0]!.slice(1,5),v.crop);
        const sheltering=draw(new Set(['barn']));assert.equal(sheltering.length,2,`${direction} sheltering`);assert.equal(sheltering[0]![0],images.get(v.interior));assert.equal(sheltering[1]![0],images.get(v.hollow));
        assert.deepEqual(sheltering[0]!.slice(1,5),v.crop);assert.deepEqual(sheltering[1]!.slice(1,5),v.crop);
        const withoutInterior=new Map([v.closed,v.open].map(file=>[file,{complete:true,naturalWidth:1536} as HTMLImageElement]));
        const calls:unknown[][]=[];drawTownBuilding({drawImage(...args:unknown[]){calls.push(args);}} as unknown as CanvasRenderingContext2D,withoutInterior,h,environment,100,17,23,[h],undefined,{sheltered:new Set(['barn'])});
        assert.equal(calls.length,1);assert.equal(calls[0]![0],withoutInterior.get(v.open),'door-open art waits in for the interior layers');
    }
});
test('farmhouse image loading includes sheltering layers only for installed directions',()=>{
    for(const direction of DIRECTIONS){
        const files=townImageFiles([barn(direction)]),v=SHELTER_VIEWS.farmhouse![direction];assert.ok(files.includes(v.closed)&&files.includes(v.open)&&files.includes(v.hollow)&&files.includes(v.interior));
        for(const other of DIRECTIONS)if(other!==direction){assert.ok(!files.includes(SHELTER_VIEWS.farmhouse![other].hollow));assert.ok(!files.includes(SHELTER_VIEWS.farmhouse![other].interior));}
    }
});
