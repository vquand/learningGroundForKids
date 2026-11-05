export interface KidAvatarOption {
  id: string;
  name: string;
  category: string;
  src: string;
  transparent?: boolean;
}

export const KID_AVATARS = [
  { id: "capybara-calm", name: "Calm Capybara", category: "Capybara", src: "/avatars/kids/capybara-calm.webp" },
  { id: "capybara-honey", name: "Honey Capybara", category: "Capybara", src: "/avatars/kids/capybara-honey.webp" },
  { id: "capybara-cream", name: "Cream Capybara", category: "Capybara", src: "/avatars/kids/capybara-cream.webp" },
  { id: "capybara-cocoa", name: "Cocoa Capybara", category: "Capybara", src: "/avatars/kids/capybara-cocoa.webp" },
  { id: "capybara-peach", name: "Peach Capybara", category: "Capybara", src: "/avatars/kids/capybara-peach.webp" },
  { id: "capybara-leaf", name: "Leaf Capybara", category: "Capybara", src: "/avatars/kids/capybara-leaf.webp" },
  { id: "dairy-cow", name: "Dairy Cow", category: "Farm Friends", src: "/avatars/kids/dairy-cow.webp", transparent: true },
  { id: "highland-cow", name: "Highland Cow", category: "Farm Friends", src: "/avatars/kids/highland-cow.webp", transparent: true },
  { id: "yellow-chick", name: "Yellow Chick", category: "Farm Friends", src: "/avatars/kids/yellow-chick.webp", transparent: true },
  { id: "moon-bunny", name: "Moon Bunny", category: "Bunny", src: "/avatars/kids/moon-bunny.webp" },
  { id: "berry-bunny", name: "Berry Bunny", category: "Bunny", src: "/avatars/kids/berry-bunny.webp" },
  { id: "lavender-bunny", name: "Lavender Bunny", category: "Bunny", src: "/avatars/kids/lavender-bunny.webp" },
  { id: "mint-bunny", name: "Mint Bunny", category: "Bunny", src: "/avatars/kids/mint-bunny.webp" },
  { id: "starlight-bunny", name: "Starlight Bunny", category: "Bunny", src: "/avatars/kids/starlight-bunny.webp" },
  { id: "corgi-gold", name: "Golden Corgi", category: "Corgi", src: "/avatars/kids/corgi-gold.webp" },
  { id: "corgi-tricolor", name: "Tricolor Corgi", category: "Corgi", src: "/avatars/kids/corgi-tricolor.webp" },
  { id: "corgi-cream", name: "Cream Corgi", category: "Corgi", src: "/avatars/kids/corgi-cream.webp" },
  { id: "corgi-wink", name: "Winking Corgi", category: "Corgi", src: "/avatars/kids/corgi-wink.webp" },
  { id: "corgi-blush", name: "Blushing Corgi", category: "Corgi", src: "/avatars/kids/corgi-blush.webp" },
  { id: "bear-cocoa", name: "Cocoa Bear", category: "Bear", src: "/avatars/kids/bear-cocoa.webp" },
  { id: "bear-honey", name: "Honey Bear", category: "Bear", src: "/avatars/kids/bear-honey.webp" },
  { id: "bear-polar", name: "Polar Bear", category: "Bear", src: "/avatars/kids/bear-polar.webp" },
  { id: "bear-panda", name: "Panda Bear", category: "Bear", src: "/avatars/kids/bear-panda.webp" },
  { id: "bear-sleepy", name: "Sleepy Bear", category: "Bear", src: "/avatars/kids/bear-sleepy.webp" },
  { id: "rabbit-snow", name: "Snow Rabbit", category: "Rabbit", src: "/avatars/kids/rabbit-snow.webp" },
  { id: "rabbit-caramel", name: "Caramel Rabbit", category: "Rabbit", src: "/avatars/kids/rabbit-caramel.webp" },
  { id: "rabbit-lop", name: "Lop-Eared Rabbit", category: "Rabbit", src: "/avatars/kids/rabbit-lop.webp" },
  { id: "rabbit-gray", name: "Gray Rabbit", category: "Rabbit", src: "/avatars/kids/rabbit-gray.webp" },
  { id: "rabbit-peach", name: "Peach Rabbit", category: "Rabbit", src: "/avatars/kids/rabbit-peach.webp" },
  { id: "otter-smile", name: "Smiling Otter", category: "Friend", src: "/avatars/kids/otter-smile.webp" },
  { id: "kitten-lilac", name: "Lilac Kitten", category: "Friend", src: "/avatars/kids/kitten-lilac.webp" },
  { id: "penguin-blue", name: "Blue Penguin", category: "Friend", src: "/avatars/kids/penguin-blue.webp" },
  { id: "red-panda-cute", name: "Red Panda", category: "Friend", src: "/avatars/kids/red-panda-cute.webp" },
  { id: "snake", name: "Friendly Snake", category: "Friend", src: "/avatars/kids/snake.webp", transparent: true },
  { id: "spider", name: "Purple Spider", category: "Friend", src: "/avatars/kids/spider.webp", transparent: true },
  { id: "chicken", name: "Cheerful Chicken", category: "Friend", src: "/avatars/kids/chicken.webp", transparent: true },
  { id: "swan", name: "Gentle Swan", category: "Friend", src: "/avatars/kids/swan.webp", transparent: true },
  { id: "duckling", name: "Little Duckling", category: "Friend", src: "/avatars/kids/duckling.webp", transparent: true },
  { id: "fish", name: "Bright Fish", category: "Friend", src: "/avatars/kids/fish.webp", transparent: true },
] as const satisfies readonly KidAvatarOption[];

// Compatibility only: old saved selections resolve to original farm-animal artwork.
const LEGACY_AVATAR_IDS: Readonly<Record<string,string>> = {
  kuromi: 'dairy-cow', 'my-melody': 'highland-cow', 'hello-kitty': 'yellow-chick',
};
export function normalizeKidAvatarId(id:string):string { return LEGACY_AVATAR_IDS[id] ?? id; }
export function resolveKidAvatar(id:string|undefined):KidAvatarOption|undefined {
  return id ? KID_AVATARS.find(avatar=>avatar.id===normalizeKidAvatarId(id)) : undefined;
}
