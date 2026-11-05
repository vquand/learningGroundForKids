// frontend/src/lib/badge_config.ts
// Display names for the badge keys and unlock milestones derived in server/src/badges.ts.

interface BadgeMeta {
  name: string;
  description: string;
}

export const BADGE_NAMES: Record<string, BadgeMeta> = {
  global_5:  { name: "Explorer",      description: "Discovered 5 things about the world!" },
  global_15: { name: "Adventurer",    description: "Explored 15 wonders!" },
  global_30: { name: "World Traveler",description: "Mastered 30 discoveries!" },

  food_5:    { name: "Foodie",        description: "Tried 5 foods from around the world!" },
  food_10:   { name: "Chef",          description: "Mastered 10 world cuisines!" },
  food_15:   { name: "Gourmet",       description: "Explored 15 world flavors!" },

  monument_5:  { name: "Sightseer",   description: "Visited 5 monuments!" },
  monument_10: { name: "Historian",   description: "Explored 10 historic monuments!" },
  monument_15: { name: "Archaeologist",description: "Discovered 15 monuments!" },

  landmark_5:  { name: "Navigator",   description: "Found 5 world landmarks!" },
  landmark_10: { name: "Cartographer",description: "Mapped 10 landmarks!" },
  landmark_15: { name: "Explorer Pro",description: "Conquered 15 world landmarks!" },

  music_5:  { name: "Music Fan",      description: "Discovered 5 world music styles!" },
  music_10: { name: "Music Lover",    description: "Explored 10 musical traditions!" },
  music_15: { name: "Maestro",        description: "Mastered 15 music styles!" },

  movie_5:  { name: "Movie Fan",      description: "Watched 5 world-famous movies!" },
  movie_10: { name: "Film Buff",      description: "Explored 10 cinema traditions!" },
  movie_15: { name: "Director",       description: "Mastered 15 cinematic worlds!" },

  animal_5:  { name: "Animal Lover",  description: "Met 5 amazing animals!" },
  animal_10: { name: "Naturalist",    description: "Discovered 10 animal species!" },
  animal_15: { name: "Wildlife Expert",description: "Mastered 15 animal wonders!" },

  phenomenon_5:  { name: "Curious Mind",  description: "Explored 5 natural phenomena!" },
  phenomenon_10: { name: "Scientist",     description: "Studied 10 world phenomena!" },
  phenomenon_15: { name: "Phenomenon Pro",description: "Mastered 15 phenomena!" },

  quiz_first:         { name: "First Quiz 🎯",    description: "Passed your very first quiz!" },
  quiz_explorer:      { name: "Quiz Explorer 📚", description: "Passed 5 quizzes!" },
  quiz_master:        { name: "Quiz Master 🏆",   description: "Passed 50 quizzes — true wisdom!" },
  quiz_daily_scholar: { name: "Daily Scholar 🌟", description: "Completed 5 daily quizzes!" },
};

export const GLOBAL_MILESTONES = [5, 15, 30] as const;
export const CATEGORY_MILESTONES = [5, 10, 15] as const;
export const WISDOM_MILESTONES = [1, 5, 50] as const;
export const DAILY_WISDOM_MILESTONES = [5] as const;
