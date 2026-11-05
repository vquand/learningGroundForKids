import type {TownCommand} from './game.ts';

/** These rules need a live gardening season or the neighbor's home schedule. */
export const townCommandNeedsWeather = (command: TownCommand): boolean =>
    command.type === 'plant' || command.type === 'help-neighbor'
    || command.type === 'build' && command.blueprintId === 'vegetable-patch';
