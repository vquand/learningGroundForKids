import { participantsSchema, type EventParticipantRef } from './participants.js';
import { AppError } from '../errors.js';

export interface EventNameVersion { from: string; title: string; icon_key: string; participants?: EventParticipantRef[] }
export function eventNameAt(event: { title: string; icon_key: string; name_history?: EventNameVersion[] }, date: string) {
  const version = event.name_history?.filter(value => value.from <= date).sort((a, b) => b.from.localeCompare(a.from))[0];
  return { title: version?.title ?? event.title, icon_key: version?.icon_key ?? event.icon_key };
}

/** The latest explicit people selection; old name-only versions retain the prior selection. */
export function eventParticipantsAt(event: {name_history?: EventNameVersion[]}, date: string): EventParticipantRef[] {
  const raw = event.name_history?.filter(value => value.from <= date && value.participants !== undefined)
    .sort((a,b) => b.from.localeCompare(a.from))[0]?.participants ?? [];
  const parsed = participantsSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/** Rename one position, never every item that happens to have the same catalog icon. */
export function renameSeriesItem<T extends object>(items: readonly T[], index: number, name: string): T[] {
  const item = items[index];
  if (!item || !('subject' in item || 'food' in item)) throw new AppError(422, 'VALIDATION_ERROR', 'This item cannot be renamed.');
  const renamed = 'subject' in item ? { ...item, name }
    : 'food' in item && item.food !== 'custom' ? { ...item, food: 'custom', icon: item.food, name } : { ...item, name };
  return items.map((value, position) => position === index ? renamed as T : value);
}
