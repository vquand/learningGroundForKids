export type LandingMinigame = {
  id: string;
  title: string;
  blurb: string;
  skills: readonly string[];
  image: string;
  alt: string;
};

export const landingAssets = {
  capybara: "/landing/companions/capybara-hero.webp",
  capybaraWink: "/landing/companions/capybara-cheer.webp",
  duckling: "/avatars/kids/duckling.webp",
  tabKids: "/avatars/kids/capybara-leaf.webp",
  tabParents: "/avatars/kids/swan.webp",
  world: "/landing/steps/explore-map.webp",
  fishing: "/landing/steps/play.webp",
  town: "/minigames/town-building/buildings-minimal-v2@l.webp",
  badges: "/landing/badges/medal.webp",
  badgeSet: "/landing/badges/medal.webp",
  otter: "/avatars/kids/otter-smile.webp",
  corgi: "/avatars/kids/corgi-gold.webp",
  rabbit: "/avatars/kids/rabbit-peach.webp",
  parentLanguage: "/illustrations/language-flags/flag-vi-v1.webp",
  parentReport: "/minigames/town-building/buildings-minimal-v2@l.webp",
  soon: "/avatars/kids/capybara-honey.webp",
  minigameFishing: "/landing/minigames/fishing.webp",
  minigameRacing: "/landing/minigames/animal-racing.webp",
  minigameWaddleWall: "/landing/minigames/waddle-wall.webp",
  minigameShooShooUfo: "/landing/minigames/shoo-shoo-ufo.webp",
  minigameInfiniDrill: "/landing/minigames/infinidrill.webp",
  minigameMiniku: "/landing/minigames/miniku.webp",
  minigameKitchen: "/landing/minigames/kitchen.webp",
  minigameDailyQuiz: "/landing/minigames/daily-quiz.webp",
} as const;

export const landingMinigames: readonly LandingMinigame[] = [
  { id: "fishing", title: "Fishing", blurb: "Catch fish, answer a question, make a friend.", skills: ["Maths"], image: landingAssets.minigameFishing, alt: "A capybara fishing by a sunny pond" },
  { id: "animal-racing", title: "Animal racing", blurb: "Answer fast and cheer on your runner.", skills: ["Maths"], image: landingAssets.minigameRacing, alt: "Animals racing along the sand lanes" },
  { id: "waddle-wall", title: "Waddle Wall", blurb: "Smash the right numbers with a waddle.", skills: ["Maths"], image: landingAssets.minigameWaddleWall, alt: "The Waddle Wall garden arena" },
  { id: "shoo-shoo-ufo", title: "Shoo Shoo UFO", blurb: "Spell words to send the visitors home.", skills: ["English", "Vietnamese"], image: landingAssets.minigameShooShooUfo, alt: "A UFO lifting a sleepy cow on a farm" },
  { id: "infinidrill", title: "InfiniDrill", blurb: "Dig deep, plan your upgrades, find treasure.", skills: ["Maths", "Planning"], image: landingAssets.minigameInfiniDrill, alt: "A colorful underground tunnel" },
  { id: "miniku", title: "Miniku", blurb: "Cozy number puzzles to solve at your pace.", skills: ["Maths", "Planning"], image: landingAssets.minigameMiniku, alt: "The cozy Miniku puzzle room" },
  { id: "kitchen", title: "Kitchen", blurb: "Cook recipes from many lands, step by step.", skills: ["Life knowledge"], image: landingAssets.minigameKitchen, alt: "A capybara making a drink" },
  { id: "daily-quiz", title: "Daily quiz", blurb: "One fresh question every day. Keep your streak.", skills: ["Reflection"], image: landingAssets.minigameDailyQuiz, alt: "A sunrise quiz scene" },
];

export const faqContent = [
  { question: "What ages is it for?", answer: "We suggest ages 5 to 8. Many activities suit 5 and 6 year olds, and some grow with children up to 8. Ages are only suggestions, never locks." },
  { question: "Is it free?", answer: "Yes, free for families and kids. We built this app to help our own child first, and we wanted to share it. The source code is available for personal, non-commercial use." },
  { question: "Is it safe and kind for my child?", answer: "There is absolutely no brainrot content. Parents can fine tune what their child explores, friends only share activity updates with no free text, and Parent Space stays locked away from little hands." },
  { question: "What skills does it help my child practice?", answer: "The big three are maths, Vietnamese and English. Along the way children also practice:", details: ["Reading and focus", "Reflection and curiosity", "Planning and organizing", "Life knowledge about the world around them"] },
  { question: "Which languages does it support?", answer: "English and Vietnamese. You can switch any time from the top bar." },
] as const;

export type LandingAchievementDifficulty = "easy" | "medium" | "hard";

export type LandingAchievement = {
  id: string;
  name: string;
  game: string;
  difficulty: LandingAchievementDifficulty;
  description: string;
  image: string;
};

export const landingAchievements: readonly LandingAchievement[] = [
  { id: "badge-1", name: "First Nibble", game: "Fishing", difficulty: "easy", description: "Catch any fish once.", image: "/landing/badges/badge-1.webp" },
  { id: "badge-2", name: "Number Miner", game: "InfiniDrill", difficulty: "easy", description: "Answer 10 main math puzzles correctly in one expedition.", image: "/landing/badges/badge-2.webp" },
  { id: "badge-3", name: "Victory Lap", game: "Animal racing", difficulty: "hard", description: "Win ten Road Racing races.", image: "/landing/badges/badge-3.webp" },
  { id: "badge-4", name: "First Waddle", game: "Waddle Wall", difficulty: "easy", description: "Pass your first wall.", image: "/landing/badges/badge-4.webp" },
  { id: "badge-5", name: "MOO MOO NO NO", game: "Shoo Shoo UFO", difficulty: "medium", description: "Take 5 space trips with the dairy cow.", image: "/landing/badges/badge-5.webp" },
  { id: "badge-6", name: "Sunny Thinker", game: "Waddle Wall", difficulty: "medium", description: "Pass 10 medium walls.", image: "/landing/badges/badge-6.webp" },
  { id: "badge-7", name: "Deep Digger", game: "InfiniDrill", difficulty: "medium", description: "Reach 720 metres, the bottom of Earth layer 6, in one expedition.", image: "/landing/badges/badge-7.webp" },
  { id: "badge-8", name: "Good Company", game: "Fishing", difficulty: "easy", description: "Complete a successful catch with all three animal friends.", image: "/landing/badges/badge-8.webp" },
  { id: "badge-9", name: "Four in a Row", game: "Daily quiz", difficulty: "medium", description: "Pass four daily quizzes in a row within one week.", image: "/landing/badges/badge-9.webp" },
];
