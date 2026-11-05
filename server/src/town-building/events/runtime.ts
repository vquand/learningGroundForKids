import type { Entity, TownState } from '../game.ts';
import type { CropId } from '../garden.ts';
import type { MapDefinition, MapId } from '../maps/types.ts';
import type { LakeRaft } from '../water/types.ts';

export interface EventWeather {
  localDate?: string; timeOfDay?: string | null; isDay?: boolean | null;
  precipitation?: string | null; weatherSource?: string;
}
export interface TimedEventRecord { edition: string; occurrence: string; data: unknown }
export interface EventFailure { eventId:string; edition:string }
export interface EventCounter { count: number; receipts: string[] }
export interface EventHistory { edition: string; counters: Record<string, EventCounter>; total?: number; byType?: Record<string, number>; builtTypes?: string[]; maxSimultaneous?: number; receipts?: string[]; }
export interface HarvestReference { entityId: string; slot: number; generation: number }
/** Plugins receive their own state and read-only world snapshots, never TownState
 * or another event's state. Durable effects are scoped, verified host operations. */
export interface EventContext {
  readonly weather: Readonly<EventWeather>;
  readonly elapsed: number;
  readonly ripeGrowth: number;
  readonly entities: readonly Readonly<Entity>[];
  /** Water structures on the map (read-only), so decorations keep clear of them. */
  readonly rafts: readonly Readonly<LakeRaft>[];
  /** The map this occurrence runs on; plugins read terrain and bounds from it. */
  readonly map: MapDefinition;
  changed(): void;
  harvest(source: HarvestReference): boolean;
  recordCompletion(counter: string, receipt: string): boolean;
}
export interface EventEdition<S> {
  readonly version: string;
  readonly harvest?: { readonly crop: CropId; readonly stamina: number };
  readonly counters?: readonly { readonly id: string; readonly achievements: readonly { readonly id: string; readonly target: number }[] }[];
  create(occurrence: string): S;
  tick(data: S, context: EventContext): void;
  interact?(data:S, command:unknown, context:EventContext):void;
  finish?(data: S, context: EventContext): void;
}
export interface TimedEvent<S> {
  readonly id: string;
  /** Undefined ends this event's occurrence. Called only with a known home clock. */
  occurrence(weather: Readonly<EventWeather>): string | undefined;
  /** Used only for a new occurrence. Existing records keep their exact edition. */
  editionFor(occurrence: string): string;
  allowsCrop?(crop:CropId,localDate:string): boolean;
  /** Maps the event runs on; absent means every map. */
  readonly maps?: readonly MapId[];
  readonly editions: readonly EventEdition<S>[];
}
interface RegisteredEdition extends Omit<EventEdition<unknown>, 'tick' | 'finish'> {
  tick(data: unknown, context: EventContext): void;
  finish?(data: unknown, context: EventContext): void;
}
export interface RegisteredEvent extends Omit<TimedEvent<unknown>, 'editions'> {
  readonly editions: ReadonlyMap<string, RegisteredEdition>;
}
export function defineTimedEvent<S>(event: TimedEvent<S>): RegisteredEvent {
  const editions = new Map<string, RegisteredEdition>();
  for (const edition of event.editions) {
    if (editions.has(edition.version)) throw new Error(`Duplicate event edition: ${event.id}/${edition.version}`);
    if (edition.harvest && (!Number.isSafeInteger(edition.harvest.stamina) || edition.harvest.stamina < 0)) throw new Error('Invalid event harvest policy');
    editions.set(edition.version, Object.freeze({ ...edition,
      ...(edition.harvest ? { harvest: Object.freeze({ ...edition.harvest }) } : {}),
      ...(edition.counters ? {counters:freeze(structuredClone(edition.counters))} : {}),
      tick: (data: unknown, context: EventContext) => edition.tick(data as S, context),
      ...(edition.interact?{interact:(data:unknown,command:unknown,context:EventContext)=>edition.interact!(data as S,command,context)}:{}),
      ...(edition.finish ? {finish:(data:unknown,context:EventContext)=>edition.finish!(data as S,context)} : {}),
    }));
  }
  return Object.freeze({ id: event.id, occurrence: event.occurrence, editionFor: event.editionFor, editions,
    ...(event.allowsCrop?{allowsCrop:event.allowsCrop}:{}),...(event.maps?{maps:event.maps}:{}), });
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
/** Runs within the garden worker's private clone and existing revision-checked
 * transaction. Each plugin commits only its own record and declared effects.
 * Unknown editions freeze in place; they never fall back to newer behavior. */
export function runTimedEvents(town: TownState, map: MapDefinition, weather: EventWeather, elapsed: number, ripeGrowth: number, events: readonly RegisteredEvent[], now=Date.now()): EventFailure[] {
  if (!weather.timeOfDay || !weather.localDate) return [];
  if (new Set(events.map(event => event.id)).size !== events.length) throw new Error('Duplicate timed event ID');
  const clock = freeze(structuredClone(weather));
  const failures:EventFailure[]=[];
  for (const event of events.filter(event=>!event.maps||event.maps.includes(map.id))) {
    // Copy only mutable host roots. executeEdition clones event data/entities.
    // A broken event cannot spend a crop or prevent another event from running.
    const draft:TownState={...town,materials:{...town.materials},
      ...(town.events?{events:{...town.events}}:{}),
      ...(town.eventHistory?{eventHistory:{...town.eventHistory,
        ...(town.eventHistory[event.id]?{[event.id]:{...town.eventHistory[event.id]}}:{})}}:{}),
    };
    try {
      runEvent(draft,map,event,clock,elapsed,ripeGrowth,now);
      Object.assign(town,draft);
    } catch {
      failures.push({eventId:event.id,edition:town.events?.[event.id]?.edition??'selection'});
    }
  }
  return failures;
}
function runEvent(town:TownState,map:MapDefinition,event:RegisteredEvent,clock:Readonly<EventWeather>,elapsed:number,ripeGrowth:number,now:number):void {
    let previous = town.events?.[event.id];
    const occurrence = event.occurrence(clock);
    if (previous && previous.occurrence !== occurrence) {
      const oldEdition = event.editions.get(previous.edition);
      if (oldEdition?.finish) executeEdition(town,map,event.id,previous,oldEdition,clock,0,ripeGrowth,now,true);
      delete town.events![event.id]; town.revision++;
      previous=undefined;
    }
    if (!occurrence) return;
    const version = previous?.edition ?? town.eventHistory?.[event.id]?.[occurrence]?.edition ?? event.editionFor(occurrence), edition = event.editions.get(version);
    if (!edition) return;
    executeEdition(town,map,event.id,previous??{edition:version,occurrence,data:edition.create(occurrence)},edition,clock,elapsed,ripeGrowth,now,false,!previous);
}
/** Authenticated, validated gameplay commands enter through this atomic host.
 * The event receives only its own state and declared completion capabilities. */
export function interactTimedEvent(town:TownState,map:MapDefinition,event:RegisteredEvent,weather:EventWeather,command:unknown,now=Date.now()):void {
    if(!weather.timeOfDay||!weather.localDate||!event.occurrence(weather)||event.maps&&!event.maps.includes(map.id))throw new Error('This celebration is not active.');
    const draft=structuredClone(town),clock=freeze(structuredClone(weather));
    runEvent(draft,map,event,clock,0,0,now);
    const record=draft.events?.[event.id],edition=record&&event.editions.get(record.edition);
    if(!record||!edition?.interact)throw new Error('This celebration edition is unavailable.');
    executeEdition(draft,map,event.id,record,edition,clock,0,0,now,false,false,{command:freeze(structuredClone(command))});
    Object.assign(town,draft);
}
function executeEdition(town:TownState,map:MapDefinition,eventId:string,record:TimedEventRecord,edition:RegisteredEdition,clock:Readonly<EventWeather>,elapsed:number,ripeGrowth:number,now:number,finishing=false,created=false,interaction?:{command:unknown}) {
    const data = structuredClone(record.data);
    const history=structuredClone(town.eventHistory?.[eventId]?.[record.occurrence]??{edition:record.edition,counters:{}});
    const earned={...town.earned};
    // Discard the whole draft if a plugin throws, including any harvested crop.
    const entities = structuredClone(town.entities);
    let snapshot: readonly Readonly<Entity>[] | undefined, rafts: readonly Readonly<LakeRaft>[] | undefined;
    let stamina = town.materials.stamina, changes = created ? 1 : 0, harvested = false, recorded=false;
    const context: EventContext = Object.freeze({
      weather: clock, elapsed: Number.isFinite(elapsed) ? Math.max(0, Math.min(15, elapsed)) : 0, ripeGrowth,
      get entities() { return snapshot ??= freeze(structuredClone(entities)); },
      get rafts() { return rafts ??= freeze(structuredClone(town.rafts ?? [])); },
      map,
      changed() { changes++; },
      harvest(source: HarvestReference) {
        const policy = edition.harvest;
        if (finishing || !policy || !Number.isInteger(source.slot) || source.slot < 0) return false;
        const patch = entities.find(entity => entity.id === source.entityId && entity.blueprintId === 'vegetable-patch');
        const slot = patch?.garden?.slots[source.slot];
        if (!slot || slot.withered || slot.crop !== policy.crop || slot.generation !== source.generation || slot.growth < ripeGrowth || !Number.isSafeInteger(stamina + policy.stamina)) return false;
        slot.growth = 0; slot.generation++; patch!.garden!.generation++; delete patch!.garden!.poop;
        stamina += policy.stamina; changes++; harvested = true; snapshot = undefined;
        return true;
      },
      recordCompletion(counter:string,receipt:string) {
        const policy=edition.counters?.find(definition=>definition.id===counter);
        if(!policy || !receipt || receipt.length>200)return false;
        const progress=history.counters[counter]??={count:0,receipts:[]};
        if(progress.receipts.includes(receipt))return false;
        progress.receipts.push(receipt);progress.count++;changes++;recorded=true;
        for(const achievement of policy.achievements)if(progress.count>=achievement.target&&!earned[achievement.id])earned[achievement.id]=new Date(now).toISOString();
        return true;
      },
    });
    if(interaction)edition.interact!(data,interaction.command,context);
    else if(finishing)edition.finish?.(data,context);else edition.tick(data, context);
    town.events ??= {};
    town.events[eventId] = { ...record, data };
    if(recorded){town.eventHistory??={};town.eventHistory[eventId]??={};town.eventHistory[eventId]![record.occurrence]=history;town.earned=earned;}
    if (harvested) { town.entities = entities; town.materials.stamina = stamina; }
    town.revision += changes;
}
