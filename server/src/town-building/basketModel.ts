import {z} from 'zod';
import {BASKET_DECORATIONS} from './basketCatalog.js';
export * from './basketCatalog.js';
export const basketSendSchema=z.object({requestId:z.string().uuid(),decoration:z.enum(BASKET_DECORATIONS),message:z.number().int().min(0).max(9)}).strict();
