/**
 * Browser-safe shared rules for buildings whose primary purpose is housing
 * animals. Residential pet capacity is deliberately not part of this list.
 */
export const ANIMAL_HOST_CHOICES = {
    farmhouse: ['dairy-cow', 'highland-cow', 'sheep', 'pig'],
    coop: ['chicken', 'duck', 'goose'],
    'animal-habitat': ['capybara', 'rabbit'],
} as const;

export const ANIMAL_HOUSE_BLUEPRINT_IDS = Object.keys(ANIMAL_HOST_CHOICES) as Array<keyof typeof ANIMAL_HOST_CHOICES>;

export function animalHostChoices(blueprintId: string): readonly string[] {
    return ANIMAL_HOST_CHOICES[blueprintId as keyof typeof ANIMAL_HOST_CHOICES] ?? [];
}

export function isDedicatedAnimalHouseBlueprint(blueprintId: string): boolean {
    return Object.prototype.hasOwnProperty.call(ANIMAL_HOST_CHOICES, blueprintId);
}
