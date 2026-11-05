import { recordAdventure } from '../adventures/events.js';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { AppError } from '../errors.js';
import { creditTown } from './repository.js';
import { FOOD_AND_DRINK_RECIPES, getFoodDrinkRecipe } from './drink-recipes.js';
import { createFoodDrinkGame, foodDrinkReducer, type FoodDrinkGameState } from './drink-game.js';
export const drinkCommandSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('start'), recipeId: z.enum(['lemonade', 'mint-tea', 'iced-coffee']) }).strict(),
    z.object({ type: z.literal('selectIngredient'), ingredientId: z.string().max(40) }).strict(),
    z.object({ type: z.enum(['skipOptionalStep', 'dismissFeedback', 'restart']) }).strict(),
]);
export type DrinkCommand = z.infer<typeof drinkCommandSchema>;
export interface DrinkSession {
    revision: number;
    sessionId: string;
    game: FoodDrinkGameState;
    optionalCompleted: number;
}
export function nextDrink(state: DrinkSession, command: DrinkCommand): {
    session: DrinkSession;
    stamina: number;
} {
    if (command.type === 'start' || command.type === 'restart') {
        const recipe = getFoodDrinkRecipe(command.type === 'start' ? command.recipeId : state.game.recipeId);
        return { session: { revision: state.revision + 1, sessionId: randomUUID(), game: createFoodDrinkGame(recipe), optionalCompleted: 0 }, stamina: 0 };
    }
    const recipe = getFoodDrinkRecipe(state.game.recipeId);
    const current = recipe.steps[state.game.stepIndex];
    const game = foodDrinkReducer(state.game, command, recipe);
    const optionalCompleted = state.optionalCompleted + (command.type === 'selectIngredient' && current?.optional && game.stepIndex > state.game.stepIndex ? 1 : 0);
    const stamina = state.game.status !== 'completed' && game.status === 'completed' ? Math.min(8, 5 + optionalCompleted) : 0;
    return { session: { ...state, revision: state.revision + 1, game, optionalCompleted }, stamina };
}
export interface DrinkRepository {
    get(id: string): Promise<DrinkSession>;
    mutate(id: string, revision: number, command: DrinkCommand): Promise<DrinkSession & {
        townReward: {
            stamina: number;
        };
    }>;
}
export function createDrinkRepository(pool: Pool): DrinkRepository {
    const initial = (): DrinkSession => ({ revision: 0, sessionId: randomUUID(), game: createFoodDrinkGame(FOOD_AND_DRINK_RECIPES[0]!), optionalCompleted: 0 });
    async function ensure(id: string) { await pool.query('INSERT INTO town_drink_sessions(profile_id,state) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, JSON.stringify(initial())]); }
    return {
        async get(id) { await ensure(id); return (await pool.query<{
            state: DrinkSession;
        }>('SELECT state FROM town_drink_sessions WHERE profile_id=$1', [id])).rows[0]!.state; },
        async mutate(id, revision, command) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await client.query('INSERT INTO town_drink_sessions(profile_id,state) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, JSON.stringify(initial())]);
                const state = (await client.query<{
                    state: DrinkSession;
                }>('SELECT state FROM town_drink_sessions WHERE profile_id=$1 FOR UPDATE', [id])).rows[0]!.state;
                if (state.revision !== revision)
                    throw new AppError(409, 'DRINK_STALE', 'Your recipe changed. Sync and try again.');
                const { session, stamina } = nextDrink(state, command);
                if(stamina)await recordAdventure(client,id,{key:`drink:${state.sessionId}`,game:'kitchen',kind:'meal_finished',data:{subject:getFoodDrinkRecipe(session.game.recipeId).title,recipeId:session.game.recipeId}});
                if (stamina)
                    await creditTown(client, id, `drink:${state.sessionId}`, { stamina });
                await client.query('UPDATE town_drink_sessions SET state=$2 WHERE profile_id=$1', [id, JSON.stringify(session)]);
                await client.query('COMMIT');
                return { ...session, townReward: { stamina } };
            }
            catch (e) {
                await client.query('ROLLBACK');
                throw e;
            }
            finally {
                client.release();
            }
        }
    };
}
