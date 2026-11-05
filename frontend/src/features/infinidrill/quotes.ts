import type { RandomSource } from "./types.ts";

export const INFINIDRILL_COMMON_QUOTES = [
  "Is that a potato-shaped rock?",
  "My seat is getting wiggly.",
  "The drill says we can do this!",
  "I wonder what sparkles down there.",
  "Tiny tunnel, big adventure.",
  "Should we pack a snack for the core?",
] as const;

export const INFINIDRILL_ANIMAL_QUOTES: Readonly<Record<string, readonly string[]>> = {
  capybara: ["A warm mud bath would be nice.", "Slow paws, steady drill."],
  rabbit: ["Any carrots down here?", "My ears felt that bump!"],
  bunny: ["Any carrots down here?", "My ears felt that bump!"],
  corgi: ["This tunnel needs a happy wiggle.", "I can dig with my tiny paws!"],
  bear: ["A cozy cave would make a great den.", "Big paws, careful drilling."],
  otter: ["I hope there is a shiny pebble!", "This drill could use a splash."],
  kitten: ["That rock definitely moved.", "Purr-haps the core is close."],
  penguin: ["I hope the deep rocks are chilly.", "Waddle we find next?"],
  "red-panda": ["A bamboo break sounds lovely.", "My tail is ready for an adventure."],
  snake: ["I can wiggle through any little tunnel.", "This drill is doing a long slither down."],
  spider: ["I could spin a web across this cave.", "Eight legs are ready for eight more metres!"],
  chicken: ["A little peck, a little drill!", "I wonder if the core is egg-shaped."],
  swan: ["Such a graceful underground journey.", "The glowing rocks are beautiful."],
  duckling: ["Quack! That was a bumpy block.", "I wonder if the lava bubbles."],
  fish: ["This cave could use a tiny pond.", "I am swimming through the soil!"],
};

function poolForAvatar(avatarId: string | undefined): readonly string[] {
  if (!avatarId) return INFINIDRILL_COMMON_QUOTES;
  const normalized = avatarId.toLowerCase();
  const family = normalized.startsWith("red-panda")
    ? "red-panda"
    : normalized.startsWith("capybara-") ? "capybara"
      : normalized.startsWith("rabbit-") ? "rabbit"
        : normalized.startsWith("corgi-") ? "corgi"
          : normalized.startsWith("bear-") ? "bear"
            : normalized.startsWith("otter-") ? "otter"
              : normalized.startsWith("kitten-") ? "kitten"
                : normalized.startsWith("penguin-") ? "penguin"
                  : normalized.startsWith("snake") ? "snake"
                    : normalized.startsWith("spider") ? "spider"
                      : normalized.startsWith("chicken") ? "chicken"
                        : normalized.startsWith("swan") ? "swan"
                          : normalized.startsWith("duckling") ? "duckling"
                            : normalized.startsWith("fish") ? "fish"
                              : normalized.includes("bunny") ? "bunny" : "";
  const animalQuotes = INFINIDRILL_ANIMAL_QUOTES[family];
  if (animalQuotes) return [...animalQuotes, ...INFINIDRILL_COMMON_QUOTES];
  return INFINIDRILL_COMMON_QUOTES;
}

export function getInfinidrillQuote(
  avatarId: string | undefined,
  random: RandomSource = Math.random,
  previousQuote?: string,
): string {
  const pool = poolForAvatar(avatarId);
  if (pool.length === 1) return pool[0] as string;
  const choices = pool.filter((quote) => quote !== previousQuote);
  return choices[Math.floor(random() * choices.length)] ?? pool[0] as string;
}
