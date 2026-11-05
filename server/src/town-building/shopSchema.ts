import {z} from 'zod';
import {CROP_IDS} from './garden.ts';
export const shopQuoteSchema=z.object({entityId:z.string().min(1).max(100),crop:z.enum(CROP_IDS),quantity:z.coerce.number().int().min(1).max(10)}).strict();
export const shopTradeSchema=z.object({type:z.literal('shop-trade'),entityId:z.string().min(1).max(100),crop:z.enum(CROP_IDS),quantity:z.number().int().min(1).max(10),confirmation:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
