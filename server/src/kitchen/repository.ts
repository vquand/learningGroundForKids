import { randomUUID } from 'node:crypto';
import { readKitchenCompletions, type KitchenCompletions } from './completions.js';
import type { Pool } from 'pg';
import { z } from 'zod';
import { AppError } from '../errors.js';
import { recordAdventure } from '../adventures/events.js';
import { getCookingRecipe } from './cookingConfig.js';
import { createCookingGame, cookingGameReducer, type CookingGameState, type CookingGameAction } from './cookingGame.js';
import { createBurgerGame, burgerReducer, BUN_SHAPES, type BurgerGame, type BurgerAction } from './burgerGame.js';
const id=z.string().min(1).max(80);
const coordinate=z.number().int().min(0).max(60);
export const cookingActionSchema=z.discriminatedUnion('type',[
  z.object({type:z.literal('place'),ingredientId:id,x:coordinate,y:coordinate}).strict(),
  z.object({type:z.literal('move'),pieceId:id,x:coordinate,y:coordinate}).strict(),
  z.object({type:z.literal('remove'),pieceId:id}).strict(),
  z.object({type:z.literal('rotate'),turns:z.number().positive().max(100)}).strict(),
  z.object({type:z.literal('season'),seasoningId:id}).strict(),
  z.object({type:z.literal('selectHeat'),level:z.enum(['low','medium','high','extreme'])}).strict(),
  z.object({type:z.enum(['advance','lockRotation','confirmSeasoning','confirmHeat','flip','dismissFeedback','restart'])}).strict(),
]);
export const burgerActionSchema=z.discriminatedUnion('type',[
  z.object({type:z.literal('shape'),value:z.enum(BUN_SHAPES)}).strict(),
  z.object({type:z.literal('toast'),value:z.enum(['pale','golden','dark'])}).strict(),
  z.object({type:z.literal('heat'),value:z.enum(['low','medium','high'])}).strict(),
  z.object({type:z.literal('sauce'),value:z.enum(['ketchup','mayo','burger-sauce'])}).strict(),
  z.object({type:z.literal('topping'),value:z.enum(['lettuce','tomato','pickles'])}).strict(),
  z.object({type:z.literal('pick'),value:z.enum(['flower','star','heart'])}).strict(),
  z.object({type:z.literal('answer'),value:z.number().int().min(0).max(100)}).strict(),
  z.object({type:z.enum(['flip','cheese','next','restart'])}).strict(),
]);
export interface KitchenSession { revision:number; sessionId:string; game:CookingGameState|BurgerGame }
export type KitchenAction=CookingGameAction|BurgerAction|{type:'restart'};
export interface KitchenRepository {
  completions(profileId:string):Promise<KitchenCompletions>;
  get(profileId:string,recipeId:string):Promise<KitchenSession>;
  mutate(profileId:string,recipeId:string,revision:number,action:KitchenAction):Promise<KitchenSession>;
}
function initial(recipeId:string,revision=0,previous?:BurgerGame):KitchenSession {
  const recipe=getCookingRecipe(recipeId);
  if(recipeId!=='burger'&&!recipe)throw new AppError(404,'RECIPE_NOT_FOUND','Recipe not found.');
  return {revision,sessionId:randomUUID(),game:recipeId==='burger'?createBurgerGame(Math.random(),previous?.thickness):createCookingGame(recipe!)};
}
export function nextKitchen(state:KitchenSession,recipeId:string,action:KitchenAction):KitchenSession {
  if(action.type==='restart')return initial(recipeId,state.revision+1,recipeId==='burger'?state.game as BurgerGame:undefined);
  const game=recipeId==='burger'?burgerReducer(state.game as BurgerGame,action as BurgerAction):cookingGameReducer(state.game as CookingGameState,action as CookingGameAction,getCookingRecipe(recipeId)!);
  return {...state,revision:state.revision+1,game};
}
export function kitchenOutcome(state:KitchenSession):'finished'|'burnt'|null {
  if('step' in state.game)return state.game.step==='serve'?'finished':null;
  if(state.game.grillDoneness==='burnt')return 'burnt';
  return state.game.status==='completed'?'finished':null;
}
export function createKitchenRepository(pool:Pool):KitchenRepository {
  async function ensure(profileId:string,recipeId:string){await pool.query('INSERT INTO kitchen_sessions(profile_id,recipe_id,state) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[profileId,recipeId,JSON.stringify(initial(recipeId))]);}
  return {
    completions: profileId => readKitchenCompletions(pool, profileId),
    async get(profileId,recipeId){await ensure(profileId,recipeId);return (await pool.query<{state:KitchenSession}>('SELECT state FROM kitchen_sessions WHERE profile_id=$1 AND recipe_id=$2',[profileId,recipeId])).rows[0]!.state;},
    async mutate(profileId,recipeId,revision,action){
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        await client.query('INSERT INTO kitchen_sessions(profile_id,recipe_id,state) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[profileId,recipeId,JSON.stringify(initial(recipeId))]);
        const state=(await client.query<{state:KitchenSession}>('SELECT state FROM kitchen_sessions WHERE profile_id=$1 AND recipe_id=$2 FOR UPDATE',[profileId,recipeId])).rows[0]!.state;
        if(state.revision!==revision)throw new AppError(409,'KITCHEN_STALE','Your recipe changed. Sync and try again.');
        const next=nextKitchen(state,recipeId,action);
        const outcome=kitchenOutcome(next);
        if(outcome&&outcome!==kitchenOutcome(state)&&next.sessionId===state.sessionId){
          await recordAdventure(client,profileId,{key:`kitchen:${state.sessionId}:outcome`,game:'kitchen',kind:outcome==='burnt'?'meal_burnt':'meal_finished',data:{subject:recipeId==='burger'?'Cozy cheeseburger':getCookingRecipe(recipeId)!.title,recipeId:recipeId==='burger'?'burger':getCookingRecipe(recipeId)!.id}});
        }
        await client.query('UPDATE kitchen_sessions SET state=$3 WHERE profile_id=$1 AND recipe_id=$2',[profileId,recipeId,JSON.stringify(next)]);
        await client.query('COMMIT');return next;
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    },
  };
}
