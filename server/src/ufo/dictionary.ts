import type { Word } from './game.js';
const words: Omit<Word, 'id'>[] = [
  {
    "word": "APPLE",
    "difficulty": "easy",
    "clue": "A crunchy fruit that can be red, green, or yellow.",
    "definition": "A fruit with crisp flesh and a peel."
  },
  {
    "word": "BABY",
    "difficulty": "easy",
    "clue": "A very young child.",
    "definition": "A very young child."
  },
  {
    "word": "BALL",
    "difficulty": "easy",
    "clue": "A round toy that you can throw, catch, or kick.",
    "definition": "A round toy for throwing, catching, or kicking."
  },
  {
    "word": "BATH",
    "difficulty": "easy",
    "clue": "Water used for washing your body.",
    "definition": "Washing the body in water."
  },
  {
    "word": "BED",
    "difficulty": "easy",
    "clue": "A soft place where you sleep.",
    "definition": "A place for sleeping."
  },
  {
    "word": "BEE",
    "difficulty": "easy",
    "clue": "A small flying insect that visits flowers.",
    "definition": "A flying insect that visits flowers."
  },
  {
    "word": "BIRD",
    "difficulty": "easy",
    "clue": "An animal with feathers, wings, and a beak.",
    "definition": "An animal with feathers, wings, and a beak."
  },
  {
    "word": "BOAT",
    "difficulty": "easy",
    "clue": "A vehicle that travels on water.",
    "definition": "A vehicle that moves on water."
  },
  {
    "word": "BOOK",
    "difficulty": "easy",
    "clue": "Pages with words or pictures that you can read.",
    "definition": "Pages joined together for reading."
  },
  {
    "word": "BOOT",
    "difficulty": "easy",
    "clue": "A sturdy shoe that covers your foot and ankle.",
    "definition": "A shoe that covers the foot and ankle."
  },
  {
    "word": "BREAD",
    "difficulty": "easy",
    "clue": "Food baked from flour and often sliced for eating.",
    "definition": "Baked food made from flour."
  },
  {
    "word": "BRUSH",
    "difficulty": "easy",
    "clue": "A tool with many bristles for cleaning or smoothing.",
    "definition": "A tool with bristles for cleaning or grooming."
  },
  {
    "word": "CAKE",
    "difficulty": "easy",
    "clue": "A sweet baked treat often served at celebrations.",
    "definition": "A sweet baked food."
  },
  {
    "word": "CAR",
    "difficulty": "easy",
    "clue": "A road vehicle with four wheels.",
    "definition": "A four-wheeled road vehicle."
  },
  {
    "word": "CAT",
    "difficulty": "easy",
    "clue": "A small furry pet that purrs.",
    "definition": "A small furry pet."
  },
  {
    "word": "CHAIR",
    "difficulty": "easy",
    "clue": "A seat with a back, usually for one person.",
    "definition": "A seat with a back."
  },
  {
    "word": "CHEESE",
    "difficulty": "easy",
    "clue": "Food made from milk that can be soft or firm.",
    "definition": "Food made from milk."
  },
  {
    "word": "CHICKEN",
    "difficulty": "easy",
    "clue": "A farm bird that lays eggs and says cluck.",
    "definition": "A farm bird that lays eggs."
  },
  {
    "word": "CLOUD",
    "difficulty": "easy",
    "clue": "A white or gray shape made of tiny water drops in the sky.",
    "definition": "A group of tiny water drops in the sky."
  },
  {
    "word": "COAT",
    "difficulty": "easy",
    "clue": "Clothing worn over other clothes to keep warm.",
    "definition": "Outer clothing that keeps you warm."
  },
  {
    "word": "CORN",
    "difficulty": "easy",
    "clue": "A crop with rows of yellow kernels.",
    "definition": "A plant with rows of kernels."
  },
  {
    "word": "COW",
    "difficulty": "easy",
    "clue": "A farm animal that can give milk.",
    "definition": "A farm animal that can give milk."
  },
  {
    "word": "CRAYON",
    "difficulty": "easy",
    "clue": "A colored stick used for drawing.",
    "definition": "A colored stick for drawing."
  },
  {
    "word": "CUP",
    "difficulty": "easy",
    "clue": "A small container for drinking.",
    "definition": "A small container for drinking."
  },
  {
    "word": "DESK",
    "difficulty": "easy",
    "clue": "A table where someone can read, write, or work.",
    "definition": "A table for reading or writing."
  },
  {
    "word": "DOG",
    "difficulty": "easy",
    "clue": "A friendly pet that barks.",
    "definition": "A pet that barks."
  },
  {
    "word": "DOOR",
    "difficulty": "easy",
    "clue": "A movable panel that opens and closes an entrance.",
    "definition": "A panel that opens an entrance."
  },
  {
    "word": "DRESS",
    "difficulty": "easy",
    "clue": "Clothing that hangs from the shoulders and covers the body.",
    "definition": "A one-piece item of clothing."
  },
  {
    "word": "DRUM",
    "difficulty": "easy",
    "clue": "A musical instrument you hit to make a beat.",
    "definition": "An instrument played by hitting its surface."
  },
  {
    "word": "DUCK",
    "difficulty": "easy",
    "clue": "A bird that swims and says quack.",
    "definition": "A swimming bird that says quack."
  },
  {
    "word": "EAR",
    "difficulty": "easy",
    "clue": "The body part that helps you notice sounds.",
    "definition": "A body part for noticing sounds."
  },
  {
    "word": "EGG",
    "difficulty": "easy",
    "clue": "A round shell that can hatch into a baby bird or be cooked.",
    "definition": "A shell that can hold a growing baby bird."
  },
  {
    "word": "EYE",
    "difficulty": "easy",
    "clue": "The body part that helps you see.",
    "definition": "The body part used for seeing."
  },
  {
    "word": "FARM",
    "difficulty": "easy",
    "clue": "A place where crops grow and animals are cared for.",
    "definition": "A place where crops and animals are cared for."
  },
  {
    "word": "FISH",
    "difficulty": "easy",
    "clue": "An animal that lives in water and uses fins.",
    "definition": "An animal that lives and breathes in water."
  },
  {
    "word": "FLAG",
    "difficulty": "easy",
    "clue": "A piece of cloth with colors or symbols that represents a place or group.",
    "definition": "Colored cloth used as a symbol."
  },
  {
    "word": "FLOWER",
    "difficulty": "easy",
    "clue": "The colorful part of a plant that can make seeds.",
    "definition": "The colorful seed-making part of many plants."
  },
  {
    "word": "FOOT",
    "difficulty": "easy",
    "clue": "The body part at the end of your leg.",
    "definition": "The body part at the bottom of the leg."
  },
  {
    "word": "FORK",
    "difficulty": "easy",
    "clue": "A utensil with pointed prongs for picking up food.",
    "definition": "A utensil with pointed prongs."
  },
  {
    "word": "FRIEND",
    "difficulty": "easy",
    "clue": "Someone you like to spend time with and help.",
    "definition": "A person you like and trust."
  },
  {
    "word": "FRUIT",
    "difficulty": "easy",
    "clue": "The part of some plants that holds seeds and can be eaten.",
    "definition": "An edible plant part that often holds seeds."
  },
  {
    "word": "GAME",
    "difficulty": "easy",
    "clue": "An activity with rules that people play for fun.",
    "definition": "An activity played for fun with rules."
  },
  {
    "word": "GARDEN",
    "difficulty": "easy",
    "clue": "A place where people grow plants.",
    "definition": "A place where plants are grown."
  },
  {
    "word": "GIFT",
    "difficulty": "easy",
    "clue": "Something given to someone to show kindness or celebrate.",
    "definition": "Something given to another person."
  },
  {
    "word": "GLASS",
    "difficulty": "easy",
    "clue": "A clear material or a drinking container.",
    "definition": "A clear material or a drinking vessel."
  },
  {
    "word": "GOAT",
    "difficulty": "easy",
    "clue": "A farm animal with horns that may climb hills.",
    "definition": "A farm animal with horns."
  },
  {
    "word": "GRASS",
    "difficulty": "easy",
    "clue": "Green plants with narrow blades that cover fields and lawns.",
    "definition": "Green plants with narrow leaves."
  },
  {
    "word": "HAND",
    "difficulty": "easy",
    "clue": "The body part at the end of your arm.",
    "definition": "The body part at the end of the arm."
  },
  {
    "word": "HAT",
    "difficulty": "easy",
    "clue": "Something worn on your head.",
    "definition": "Headwear."
  },
  {
    "word": "HEN",
    "difficulty": "easy",
    "clue": "A female chicken.",
    "definition": "An adult female chicken."
  },
  {
    "word": "HILL",
    "difficulty": "easy",
    "clue": "A raised area of land smaller than a mountain.",
    "definition": "Raised land smaller than a mountain."
  },
  {
    "word": "HORSE",
    "difficulty": "easy",
    "clue": "A large farm animal that people can ride.",
    "definition": "A large animal that people can ride."
  },
  {
    "word": "HOUSE",
    "difficulty": "easy",
    "clue": "A building where people live.",
    "definition": "A building where people live."
  },
  {
    "word": "ICE",
    "difficulty": "easy",
    "clue": "Frozen water that feels cold and hard.",
    "definition": "Water in its frozen form."
  },
  {
    "word": "JUMP",
    "difficulty": "easy",
    "clue": "To push off the ground and go up.",
    "definition": "To push up from the ground."
  },
  {
    "word": "KEY",
    "difficulty": "easy",
    "clue": "A small tool that opens a lock.",
    "definition": "A tool that opens a lock."
  },
  {
    "word": "KITE",
    "difficulty": "easy",
    "clue": "A light toy that flies on a string in the wind.",
    "definition": "A light flying toy on a string."
  },
  {
    "word": "LAKE",
    "difficulty": "easy",
    "clue": "A large area of water surrounded by land.",
    "definition": "Water surrounded by land."
  },
  {
    "word": "LAMP",
    "difficulty": "easy",
    "clue": "An object that gives light inside a room.",
    "definition": "An object that provides light."
  },
  {
    "word": "LEAF",
    "difficulty": "easy",
    "clue": "A flat green part of a plant.",
    "definition": "A flat plant part that catches light."
  },
  {
    "word": "LEG",
    "difficulty": "easy",
    "clue": "The body part used to stand and walk.",
    "definition": "A body part used for standing and walking."
  },
  {
    "word": "LION",
    "difficulty": "easy",
    "clue": "A large wild cat with a loud roar.",
    "definition": "A large wild cat."
  },
  {
    "word": "MILK",
    "difficulty": "easy",
    "clue": "A white drink that can come from a cow.",
    "definition": "A nutritious drink made by some animals."
  },
  {
    "word": "MOON",
    "difficulty": "easy",
    "clue": "The bright object that travels around Earth at night.",
    "definition": "Earth's natural object that shines at night."
  },
  {
    "word": "MOUSE",
    "difficulty": "easy",
    "clue": "A tiny animal with whiskers and a long tail.",
    "definition": "A small animal with whiskers."
  },
  {
    "word": "MUSIC",
    "difficulty": "easy",
    "clue": "Sounds arranged to make a song or tune.",
    "definition": "Organized sounds that make a tune."
  },
  {
    "word": "NEST",
    "difficulty": "easy",
    "clue": "A home that a bird builds for eggs or babies.",
    "definition": "A bird's home for eggs or babies."
  },
  {
    "word": "NOSE",
    "difficulty": "easy",
    "clue": "The body part used for smelling and breathing.",
    "definition": "The body part for smelling and breathing."
  },
  {
    "word": "ORANGE",
    "difficulty": "easy",
    "clue": "A round citrus fruit with a peel.",
    "definition": "A round citrus fruit."
  },
  {
    "word": "PANTS",
    "difficulty": "easy",
    "clue": "Clothing that covers both legs.",
    "definition": "Clothing that covers the legs."
  },
  {
    "word": "PARK",
    "difficulty": "easy",
    "clue": "An outdoor place with space to play or walk.",
    "definition": "An outdoor place for play or walks."
  },
  {
    "word": "PEAR",
    "difficulty": "easy",
    "clue": "A sweet fruit that is wider at the bottom.",
    "definition": "A sweet fruit with a narrow top."
  },
  {
    "word": "PENCIL",
    "difficulty": "easy",
    "clue": "A writing tool that can be sharpened.",
    "definition": "A writing tool with a graphite tip."
  },
  {
    "word": "PIG",
    "difficulty": "easy",
    "clue": "A farm animal with a curly tail and a snout.",
    "definition": "A farm animal with a snout."
  },
  {
    "word": "PLANT",
    "difficulty": "easy",
    "clue": "A living thing that grows in soil or water.",
    "definition": "A living thing that grows."
  },
  {
    "word": "PLATE",
    "difficulty": "easy",
    "clue": "A flat dish used to hold food.",
    "definition": "A flat dish for food."
  },
  {
    "word": "RAIN",
    "difficulty": "easy",
    "clue": "Drops of water that fall from clouds.",
    "definition": "Water drops falling from clouds."
  },
  {
    "word": "RABBIT",
    "difficulty": "easy",
    "clue": "A small animal with long ears that hops.",
    "definition": "A hopping animal with long ears."
  },
  {
    "word": "RIVER",
    "difficulty": "easy",
    "clue": "Moving water that flows toward a lake or sea.",
    "definition": "Flowing water moving across land."
  },
  {
    "word": "ROAD",
    "difficulty": "easy",
    "clue": "A paved path where vehicles travel.",
    "definition": "A path for vehicles."
  },
  {
    "word": "ROCK",
    "difficulty": "easy",
    "clue": "A hard piece of stone found outdoors.",
    "definition": "A hard piece of stone."
  },
  {
    "word": "ROOF",
    "difficulty": "easy",
    "clue": "The top covering of a building.",
    "definition": "The top covering of a building."
  },
  {
    "word": "SCHOOL",
    "difficulty": "easy",
    "clue": "A place where children learn.",
    "definition": "A place where children learn."
  },
  {
    "word": "SHOE",
    "difficulty": "easy",
    "clue": "Something worn on a foot.",
    "definition": "Footwear."
  },
  {
    "word": "SLEEP",
    "difficulty": "easy",
    "clue": "The resting time when your body and brain recharge.",
    "definition": "Resting time for the body and brain."
  },
  {
    "word": "SMILE",
    "difficulty": "easy",
    "clue": "A happy expression made with your mouth.",
    "definition": "A happy look made with the mouth."
  },
  {
    "word": "SOCK",
    "difficulty": "easy",
    "clue": "A soft covering worn inside a shoe.",
    "definition": "A soft covering for the foot."
  },
  {
    "word": "SOUP",
    "difficulty": "easy",
    "clue": "A warm food made by cooking ingredients in liquid.",
    "definition": "Food made by cooking ingredients in liquid."
  },
  {
    "word": "STAR",
    "difficulty": "easy",
    "clue": "A bright ball of hot gas in the night sky.",
    "definition": "A glowing ball of gas in space."
  },
  {
    "word": "SUN",
    "difficulty": "easy",
    "clue": "The star that gives Earth light and warmth.",
    "definition": "The star that lights and warms Earth."
  },
  {
    "word": "TABLE",
    "difficulty": "easy",
    "clue": "Furniture with a flat top and legs.",
    "definition": "Furniture with a flat top."
  },
  {
    "word": "TEACHER",
    "difficulty": "easy",
    "clue": "An adult who helps children learn.",
    "definition": "An adult who helps others learn."
  },
  {
    "word": "TIGER",
    "difficulty": "easy",
    "clue": "A striped wild cat.",
    "definition": "A striped wild cat."
  },
  {
    "word": "TOY",
    "difficulty": "easy",
    "clue": "An object made for children to play with.",
    "definition": "An object made for play."
  },
  {
    "word": "TREE",
    "difficulty": "easy",
    "clue": "A tall plant with a trunk and branches.",
    "definition": "A tall plant with a trunk."
  },
  {
    "word": "TRUCK",
    "difficulty": "easy",
    "clue": "A large road vehicle used to carry things.",
    "definition": "A large vehicle for carrying things."
  },
  {
    "word": "WATER",
    "difficulty": "easy",
    "clue": "A clear liquid that people, plants, and animals need.",
    "definition": "A liquid needed by people, plants, and animals."
  },
  {
    "word": "WINDOW",
    "difficulty": "easy",
    "clue": "An opening in a wall with glass that lets in light.",
    "definition": "A glass opening that lets in light."
  },
  {
    "word": "YELLOW",
    "difficulty": "easy",
    "clue": "The color of bananas and many school buses.",
    "definition": "A bright color like a banana."
  },
  {
    "word": "ZEBRA",
    "difficulty": "easy",
    "clue": "An animal with black and white stripes.",
    "definition": "A striped animal related to horses."
  },
  {
    "word": "ANT",
    "clue": "A tiny insect that often walks in a line with others.",
    "definition": "A small insect that lives in a colony.",
    "difficulty": "easy"
  },
  {
    "word": "BAT",
    "clue": "An animal with furry skin and wings that flies at night.",
    "definition": "A flying mammal that is usually active at night.",
    "difficulty": "easy"
  },
  {
    "word": "BEAR",
    "clue": "A large furry animal with strong paws that may sleep through winter.",
    "definition": "A large mammal with thick fur and strong paws.",
    "difficulty": "easy"
  },
  {
    "word": "CAMEL",
    "clue": "A desert animal with one or two humps on its back.",
    "definition": "A mammal with humps that can live in dry places.",
    "difficulty": "easy"
  },
  {
    "word": "CRAB",
    "clue": "A sea animal with a hard shell and two claws that often walks sideways.",
    "definition": "A shell-covered animal with claws and ten legs.",
    "difficulty": "easy"
  },
  {
    "word": "DEER",
    "clue": "A shy animal with hooves; the males of many kinds grow antlers.",
    "definition": "A hoofed mammal that often lives in woods or grasslands.",
    "difficulty": "easy"
  },
  {
    "word": "DOLPHIN",
    "clue": "A sea animal that breathes air, clicks, and often leaps out of the water.",
    "definition": "A sea mammal with a curved fin on its back.",
    "difficulty": "easy"
  },
  {
    "word": "ELEPHANT",
    "clue": "A huge animal with a long trunk and big ears.",
    "definition": "A large mammal with a trunk and broad ears.",
    "difficulty": "easy"
  },
  {
    "word": "FOX",
    "clue": "A wild animal with pointed ears and a bushy tail, often with red fur.",
    "definition": "A small wild member of the dog family with a bushy tail.",
    "difficulty": "easy"
  },
  {
    "word": "FROG",
    "clue": "A small animal that croaks, jumps, and starts life as a tadpole.",
    "definition": "An amphibian with strong back legs for jumping.",
    "difficulty": "easy"
  },
  {
    "word": "GIRAFFE",
    "clue": "A spotted animal with a very long neck that eats leaves from tall trees.",
    "definition": "A tall African mammal with a long neck.",
    "difficulty": "easy"
  },
  {
    "word": "HIPPO",
    "clue": "A huge African animal with short legs and a wide mouth that spends much of the day in water.",
    "definition": "A large mammal that spends much of its time in rivers or lakes.",
    "difficulty": "easy"
  },
  {
    "word": "KANGAROO",
    "clue": "An Australian animal that hops on strong back legs and carries its baby in a pouch.",
    "definition": "A hopping mammal whose mother carries her baby in a pouch.",
    "difficulty": "easy"
  },
  {
    "word": "KOALA",
    "clue": "An Australian animal with fluffy ears that eats eucalyptus leaves.",
    "definition": "An Australian tree-dwelling mammal that eats eucalyptus leaves.",
    "difficulty": "easy"
  },
  {
    "word": "LAMB",
    "clue": "A baby sheep.",
    "definition": "A young sheep.",
    "difficulty": "easy"
  },
  {
    "word": "MONKEY",
    "clue": "An animal with grasping hands that often climbs trees and may have a long tail.",
    "definition": "A primate with grasping hands, usually with a tail.",
    "difficulty": "easy"
  },
  {
    "word": "OWL",
    "clue": "A bird with large eyes that often hunts at night and says hoot.",
    "definition": "A bird of prey with large eyes and a round face.",
    "difficulty": "easy"
  },
  {
    "word": "PANDA",
    "clue": "A black-and-white bear that loves to eat bamboo.",
    "definition": "A black-and-white bear from China that mainly eats bamboo.",
    "difficulty": "easy"
  },
  {
    "word": "PARROT",
    "clue": "A bird with a curved beak that can copy sounds and words.",
    "definition": "A bird with a hooked beak, often with colorful feathers.",
    "difficulty": "easy"
  },
  {
    "word": "PENGUIN",
    "clue": "A black-and-white bird that swims well but cannot fly.",
    "definition": "A flightless seabird that uses its wings to swim.",
    "difficulty": "easy"
  },
  {
    "word": "PUPPY",
    "clue": "A baby dog.",
    "definition": "A young dog.",
    "difficulty": "easy"
  },
  {
    "word": "KITTEN",
    "clue": "A baby cat.",
    "definition": "A young cat.",
    "difficulty": "easy"
  },
  {
    "word": "SEAL",
    "clue": "A sea mammal with flippers that rests on beaches or ice.",
    "definition": "A sea mammal with flippers and a smooth body.",
    "difficulty": "easy"
  },
  {
    "word": "SHARK",
    "clue": "A fish with a skeleton made of cartilage; many kinds have rows of sharp teeth.",
    "definition": "A fish with fins and a skeleton made of cartilage.",
    "difficulty": "easy"
  },
  {
    "word": "SHEEP",
    "clue": "A farm animal with a woolly coat that says baa.",
    "definition": "A farm animal raised for wool, milk, or meat.",
    "difficulty": "easy"
  },
  {
    "word": "SNAIL",
    "clue": "A slow little animal with a shell on its back that leaves a shiny trail.",
    "definition": "A soft-bodied animal that moves on one broad foot and usually has a shell.",
    "difficulty": "easy"
  },
  {
    "word": "SNAKE",
    "clue": "A long animal with scales that slithers and has no legs.",
    "definition": "A long reptile without legs.",
    "difficulty": "easy"
  },
  {
    "word": "TURTLE",
    "clue": "A reptile with a hard shell that protects its body.",
    "definition": "A reptile whose body is covered by a bony shell.",
    "difficulty": "easy"
  },
  {
    "word": "WHALE",
    "clue": "A huge sea mammal that breathes through a hole on top of its head.",
    "definition": "A sea mammal that breathes air through a blowhole.",
    "difficulty": "easy"
  },
  {
    "word": "WOLF",
    "clue": "A wild relative of a dog that may howl and live in a pack.",
    "definition": "A wild member of the dog family that often lives in a pack.",
    "difficulty": "easy"
  },
  {
    "word": "BANANA",
    "clue": "A long yellow fruit with a peel that you pull down before eating.",
    "definition": "A long curved fruit with a soft inside and thick peel.",
    "difficulty": "easy"
  },
  {
    "word": "GRAPE",
    "clue": "A small round fruit that grows in bunches and can be made into raisins.",
    "definition": "A small juicy fruit that grows in bunches on vines.",
    "difficulty": "easy"
  },
  {
    "word": "LEMON",
    "clue": "A sour yellow fruit often squeezed into water or used to make a sweet summer drink.",
    "definition": "A yellow citrus fruit with sour juice.",
    "difficulty": "easy"
  },
  {
    "word": "LIME",
    "clue": "A small green citrus fruit with sour juice.",
    "definition": "A usually green citrus fruit with sour juice.",
    "difficulty": "easy"
  },
  {
    "word": "PEACH",
    "clue": "A juicy fruit with fuzzy skin and one large stone inside.",
    "definition": "A soft juicy fruit with fuzzy skin and a hard stone.",
    "difficulty": "easy"
  },
  {
    "word": "PLUM",
    "clue": "A small juicy fruit, often purple, with smooth skin and one hard stone.",
    "definition": "A smooth-skinned fruit with a single stone.",
    "difficulty": "easy"
  },
  {
    "word": "MELON",
    "clue": "A large round fruit with a thick rind and sweet juicy flesh.",
    "definition": "A sweet fruit with a thick outer rind.",
    "difficulty": "easy"
  },
  {
    "word": "CHERRY",
    "clue": "A small red fruit with a thin stem and one hard stone inside.",
    "definition": "A small round fruit with a stone in the middle.",
    "difficulty": "easy"
  },
  {
    "word": "BERRY",
    "clue": "A small juicy fruit, such as a raspberry or blueberry.",
    "definition": "A small juicy fruit, often growing on a bush or low plant.",
    "difficulty": "easy"
  },
  {
    "word": "KIWI",
    "clue": "A fruit with fuzzy brown skin and green flesh full of tiny black seeds.",
    "definition": "A small fruit with brown skin and usually green flesh.",
    "difficulty": "easy"
  },
  {
    "word": "COCONUT",
    "clue": "A large fruit with a hard brown shell, white flesh, and water inside.",
    "definition": "A palm fruit with a hard shell and edible white flesh.",
    "difficulty": "easy"
  },
  {
    "word": "PINEAPPLE",
    "clue": "A tropical fruit with rough skin and a crown of spiky green leaves.",
    "definition": "A tropical fruit with sweet yellow flesh and tough skin.",
    "difficulty": "easy"
  },
  {
    "word": "WATERMELON",
    "clue": "A large fruit with a green rind and juicy pink or red flesh, often eaten in summer.",
    "definition": "A large juicy fruit with a thick green rind.",
    "difficulty": "easy"
  },
  {
    "word": "STRAWBERRY",
    "clue": "A red fruit with tiny seeds on the outside and a leafy green top.",
    "definition": "A sweet red fruit with seeds on its surface.",
    "difficulty": "easy"
  },
  {
    "word": "BLUEBERRY",
    "clue": "A small round blue fruit often put in muffins.",
    "definition": "A small blue fruit that grows on a bush.",
    "difficulty": "easy"
  },
  {
    "word": "RASPBERRY",
    "clue": "A soft red fruit made of many tiny juicy bumps, with a hollow middle.",
    "definition": "A soft fruit made of many small juicy parts.",
    "difficulty": "easy"
  },
  {
    "word": "APRICOT",
    "clue": "A small orange fruit like a peach, with smooth or slightly fuzzy skin and one stone.",
    "definition": "A small orange fruit with a hard stone inside.",
    "difficulty": "easy"
  },
  {
    "word": "AVOCADO",
    "clue": "A fruit with creamy green flesh and one large seed, often mashed for guacamole.",
    "definition": "A fruit with green flesh and a large central seed.",
    "difficulty": "easy"
  },
  {
    "word": "PAPAYA",
    "clue": "A tropical fruit with orange flesh and many small black seeds in the middle.",
    "definition": "A tropical fruit with soft flesh and many black seeds.",
    "difficulty": "easy"
  },
  {
    "word": "MANGO",
    "clue": "A tropical fruit with golden flesh and a large flat stone inside.",
    "definition": "A juicy tropical fruit with a large flat stone.",
    "difficulty": "easy"
  },
  {
    "word": "RICE",
    "clue": "Small grains often served in a bowl with vegetables or curry.",
    "definition": "Edible grains cooked in water and eaten as food.",
    "difficulty": "easy"
  },
  {
    "word": "PASTA",
    "clue": "Food made from dough in shapes such as spaghetti, bows, or shells.",
    "definition": "Dried or fresh dough shapes cooked in boiling water.",
    "difficulty": "easy"
  },
  {
    "word": "PIZZA",
    "clue": "A flat round food topped with tomato sauce and cheese, often cut into triangles.",
    "definition": "A baked flat dough base with savory toppings.",
    "difficulty": "easy"
  },
  {
    "word": "NOODLE",
    "clue": "One long thin strip of dough that you can eat in soup.",
    "definition": "A thin strip of dough cooked in water or broth.",
    "difficulty": "easy"
  },
  {
    "word": "BURGER",
    "clue": "A round bun with a patty inside, often served with fries.",
    "definition": "A patty served inside a split bun.",
    "difficulty": "easy"
  },
  {
    "word": "SANDWICH",
    "clue": "Two slices of bread with a filling between them.",
    "definition": "Food made by putting a filling between pieces of bread.",
    "difficulty": "easy"
  },
  {
    "word": "COOKIE",
    "clue": "A small sweet baked treat, often with chocolate chips.",
    "definition": "A small sweet baked snack.",
    "difficulty": "easy"
  },
  {
    "word": "BISCUIT",
    "clue": "A small crisp baked snack, called a cookie in American English.",
    "definition": "A small baked food; in British English, a crisp sweet or savory snack.",
    "difficulty": "easy"
  },
  {
    "word": "PANCAKE",
    "clue": "A flat round food cooked in a pan and often eaten with syrup.",
    "definition": "A flat cake made from batter and cooked in a pan.",
    "difficulty": "easy"
  },
  {
    "word": "WAFFLE",
    "clue": "A breakfast food with little square pockets that can hold syrup.",
    "definition": "Batter cooked between patterned hot plates.",
    "difficulty": "easy"
  },
  {
    "word": "TOAST",
    "clue": "Bread made brown and crisp by heating it.",
    "definition": "Bread browned by heat.",
    "difficulty": "easy"
  },
  {
    "word": "BUTTER",
    "clue": "A creamy yellow food often spread on bread, made by churning cream.",
    "definition": "A food made by churning cream.",
    "difficulty": "easy"
  },
  {
    "word": "YOGURT",
    "clue": "A thick creamy food made from milk, often eaten with fruit.",
    "definition": "Milk thickened by helpful bacteria.",
    "difficulty": "easy"
  },
  {
    "word": "CEREAL",
    "clue": "A breakfast food made of crunchy flakes or little rings, often eaten with milk.",
    "definition": "Grain-based food often served with milk for breakfast.",
    "difficulty": "easy"
  },
  {
    "word": "HONEY",
    "clue": "A sweet sticky golden food made by bees.",
    "definition": "A sweet food that bees make from flower nectar.",
    "difficulty": "easy"
  },
  {
    "word": "JAM",
    "clue": "A sweet fruity spread often put on bread or toast.",
    "definition": "A thick spread made by cooking fruit with sugar.",
    "difficulty": "easy"
  },
  {
    "word": "PEANUT",
    "clue": "A small snack that grows in a shell underground and can be ground into a creamy spread.",
    "definition": "The edible seed of a plant that grows pods underground.",
    "difficulty": "easy"
  },
  {
    "word": "POTATO",
    "clue": "A vegetable that grows underground and is used to make fries or mash.",
    "definition": "An edible underground tuber.",
    "difficulty": "easy"
  },
  {
    "word": "TOMATO",
    "clue": "A juicy red fruit often sliced into salads or used to make ketchup.",
    "definition": "A juicy fruit used as a vegetable in cooking.",
    "difficulty": "easy"
  },
  {
    "word": "CARROT",
    "clue": "A crunchy orange root vegetable that rabbits like to nibble.",
    "definition": "An edible root vegetable, usually orange.",
    "difficulty": "easy"
  },
  {
    "word": "BEAN",
    "clue": "An edible seed that grows inside a pod, often cooked in soup.",
    "definition": "An edible seed or pod of certain plants.",
    "difficulty": "easy"
  },
  {
    "word": "PEA",
    "clue": "A tiny round green seed that grows in a pod with others.",
    "definition": "A small round edible seed from a pod.",
    "difficulty": "easy"
  },
  {
    "word": "ONION",
    "clue": "A round vegetable with many layers that can make your eyes water when cut.",
    "definition": "A bulb vegetable with layers and a strong smell.",
    "difficulty": "easy"
  },
  {
    "word": "SALAD",
    "clue": "A dish of mixed vegetables, often with lettuce and a dressing.",
    "definition": "A dish of mixed ingredients, often raw vegetables.",
    "difficulty": "easy"
  },
  {
    "word": "SAUSAGE",
    "clue": "A tube-shaped food often made from seasoned meat and cooked in a pan.",
    "definition": "A food made from a seasoned filling inside a thin casing.",
    "difficulty": "easy"
  },
  {
    "word": "JUICE",
    "clue": "A drink squeezed or pressed from fruit or vegetables.",
    "definition": "Liquid taken from fruit or vegetables.",
    "difficulty": "easy"
  },
  {
    "word": "TEA",
    "clue": "A drink made by putting special leaves in hot water.",
    "definition": "A drink made by soaking leaves in hot water.",
    "difficulty": "easy"
  },
  {
    "word": "LEMONADE",
    "clue": "A sweet drink made with sour yellow citrus juice, water, and sugar.",
    "definition": "A drink made from lemon juice, water, and sugar.",
    "difficulty": "easy"
  },
  {
    "word": "COCOA",
    "clue": "A warm chocolate drink often served with marshmallows.",
    "definition": "A chocolate drink made using a powder from cacao beans.",
    "difficulty": "easy"
  },
  {
    "word": "SMOOTHIE",
    "clue": "A thick drink made by blending fruit, often with milk or yogurt.",
    "definition": "A thick blended drink, usually made with fruit.",
    "difficulty": "easy"
  },
  {
    "word": "MILKSHAKE",
    "clue": "A cold sweet drink made by blending milk and ice cream.",
    "definition": "A drink made by mixing milk with ice cream or flavoring.",
    "difficulty": "easy"
  },
  {
    "word": "SODA",
    "clue": "A sweet fizzy drink with lots of bubbles.",
    "definition": "A carbonated drink, often sweetened and flavored.",
    "difficulty": "easy"
  },
  {
    "word": "COFFEE",
    "clue": "A drink for grown-ups made from roasted brown beans, often served hot.",
    "definition": "A drink brewed from roasted coffee beans.",
    "difficulty": "easy"
  },
  {
    "word": "BUS",
    "clue": "A large road vehicle that carries many passengers and stops along a route.",
    "definition": "A large motor vehicle for carrying passengers.",
    "difficulty": "easy"
  },
  {
    "word": "TRAIN",
    "clue": "A row of carriages pulled along railway tracks.",
    "definition": "A connected set of railway vehicles.",
    "difficulty": "easy"
  },
  {
    "word": "PLANE",
    "clue": "A vehicle with wings that carries people through the sky.",
    "definition": "A powered aircraft with fixed wings.",
    "difficulty": "easy"
  },
  {
    "word": "SHIP",
    "clue": "A very large boat that carries people or goods across the sea.",
    "definition": "A large vessel for traveling on water.",
    "difficulty": "easy"
  },
  {
    "word": "TAXI",
    "clue": "A car with a driver that you pay to take you where you want to go.",
    "definition": "A car hired with a driver for a journey.",
    "difficulty": "easy"
  },
  {
    "word": "VAN",
    "clue": "A road vehicle bigger than most cars, often used to carry packages.",
    "definition": "A covered motor vehicle for carrying goods or people.",
    "difficulty": "easy"
  },
  {
    "word": "JEEP",
    "clue": "A sturdy vehicle often used on bumpy roads, with a name that starts with J.",
    "definition": "A type of vehicle designed for rough ground.",
    "difficulty": "easy"
  },
  {
    "word": "TRACTOR",
    "clue": "A powerful farm vehicle used to pull plows and trailers.",
    "definition": "A strong vehicle used to pull farm equipment.",
    "difficulty": "easy"
  },
  {
    "word": "SCOOTER",
    "clue": "A ride with a standing deck and handlebars that you can push with one foot.",
    "definition": "A small vehicle with a deck, handlebars, and wheels.",
    "difficulty": "easy"
  },
  {
    "word": "BICYCLE",
    "clue": "A vehicle with two wheels that you move by turning pedals.",
    "definition": "A two-wheeled vehicle powered by pedals.",
    "difficulty": "easy"
  },
  {
    "word": "HELICOPTER",
    "clue": "An aircraft with large spinning blades above it that can hover in one place.",
    "definition": "An aircraft lifted by rotating blades.",
    "difficulty": "easy"
  },
  {
    "word": "ROCKET",
    "clue": "A vehicle that blasts upward and can carry astronauts into space.",
    "definition": "A vehicle pushed forward by gases shooting out of it.",
    "difficulty": "easy"
  },
  {
    "word": "AMBULANCE",
    "clue": "A vehicle with a siren that takes sick or injured people to hospital.",
    "definition": "A vehicle equipped to carry people who need medical care.",
    "difficulty": "easy"
  },
  {
    "word": "FIRETRUCK",
    "clue": "A large emergency vehicle that carries firefighters, hoses, and ladders.",
    "definition": "A vehicle carrying equipment for fighting fires.",
    "difficulty": "easy"
  },
  {
    "word": "SKATEBOARD",
    "clue": "A board with four small wheels that you stand on and ride.",
    "definition": "A short board on wheels used for riding and tricks.",
    "difficulty": "easy"
  },
  {
    "word": "TRAM",
    "clue": "A passenger vehicle that runs on rails along city streets.",
    "definition": "A passenger rail vehicle that runs along streets.",
    "difficulty": "easy"
  },
  {
    "word": "CANOE",
    "clue": "A narrow open boat that you move with a paddle.",
    "definition": "A light narrow boat moved with paddles.",
    "difficulty": "easy"
  },
  {
    "word": "ANCHOR",
    "difficulty": "medium",
    "clue": "A heavy object that helps a boat stay in one place.",
    "definition": "A heavy tool that holds a boat in place."
  },
  {
    "word": "ANTENNA",
    "difficulty": "medium",
    "clue": "A thin part that receives signals or helps an insect sense things.",
    "definition": "A part that receives signals or senses surroundings."
  },
  {
    "word": "BEAKER",
    "difficulty": "medium",
    "clue": "A small container used for holding liquids in a science activity.",
    "definition": "A science container for liquids."
  },
  {
    "word": "BUBBLE",
    "difficulty": "medium",
    "clue": "A little ball of air floating in water or soap.",
    "definition": "A thin pocket of air in liquid."
  },
  {
    "word": "CAMOUFLAGE",
    "difficulty": "medium",
    "clue": "Colors or shapes that help something blend into its surroundings.",
    "definition": "A covering or pattern that helps hide something."
  },
  {
    "word": "CATERPILLAR",
    "difficulty": "medium",
    "clue": "A soft, crawling young insect that may become a butterfly.",
    "definition": "A crawling young insect."
  },
  {
    "word": "COMET",
    "difficulty": "medium",
    "clue": "A space object that can grow a bright tail near a star.",
    "definition": "An icy space object that may have a glowing tail."
  },
  {
    "word": "CONSTELLATION",
    "difficulty": "medium",
    "clue": "A group of stars that makes a picture in the night sky.",
    "definition": "A named pattern of stars."
  },
  {
    "word": "CURRENT",
    "difficulty": "medium",
    "clue": "Moving water in a river or sea.",
    "definition": "Water moving in one direction."
  },
  {
    "word": "DESERT",
    "difficulty": "medium",
    "clue": "A dry place that gets very little rain.",
    "definition": "A dry region with very little rain."
  },
  {
    "word": "DIAMOND",
    "difficulty": "medium",
    "clue": "A very hard, shiny stone often cut into many faces.",
    "definition": "A very hard, sparkling gemstone."
  },
  {
    "word": "DINOSAUR",
    "difficulty": "medium",
    "clue": "An ancient animal that lived long before people.",
    "definition": "An ancient animal from long ago."
  },
  {
    "word": "ENERGY",
    "difficulty": "medium",
    "clue": "What makes things move, grow, or work.",
    "definition": "The power that makes things happen."
  },
  {
    "word": "ENGINE",
    "difficulty": "medium",
    "clue": "A machine that gives a vehicle power to move.",
    "definition": "A machine that provides movement power."
  },
  {
    "word": "FEATHER",
    "difficulty": "medium",
    "clue": "A light covering that grows on a bird.",
    "definition": "A light, soft part of a bird's covering."
  },
  {
    "word": "FOSSIL",
    "difficulty": "medium",
    "clue": "A mark or remains of an ancient living thing kept in rock.",
    "definition": "A preserved sign of ancient life."
  },
  {
    "word": "GALAXY",
    "difficulty": "medium",
    "clue": "A huge group of stars, gas, and dust in space.",
    "definition": "A huge collection of stars."
  },
  {
    "word": "GLOBE",
    "difficulty": "medium",
    "clue": "A round model that shows the whole Earth.",
    "definition": "A round model of Earth."
  },
  {
    "word": "GRAVITY",
    "difficulty": "medium",
    "clue": "The force that pulls things toward the ground.",
    "definition": "The pull that brings things toward Earth."
  },
  {
    "word": "HERBIVORE",
    "difficulty": "medium",
    "clue": "An animal whose food comes mostly from plants.",
    "definition": "An animal that mainly eats plants."
  },
  {
    "word": "HIBERNATE",
    "difficulty": "medium",
    "clue": "To spend a long cold season resting in a very deep sleep.",
    "definition": "To rest through a cold season."
  },
  {
    "word": "MAGNET",
    "difficulty": "medium",
    "clue": "An object that can pull some kinds of metal toward it.",
    "definition": "An object that pulls certain metals."
  },
  {
    "word": "MATERIAL",
    "difficulty": "medium",
    "clue": "What an object is made from, such as wood or glass.",
    "definition": "The substance an object is made from."
  },
  {
    "word": "MEASURE",
    "difficulty": "medium",
    "clue": "To find out how long, heavy, or much something is.",
    "definition": "To find an amount, size, or length."
  },
  {
    "word": "METAL",
    "difficulty": "medium",
    "clue": "A strong shiny material used for cans, tools, and wires.",
    "definition": "A strong material used in many objects."
  },
  {
    "word": "METEOR",
    "difficulty": "medium",
    "clue": "A space rock that glows when it streaks through the sky.",
    "definition": "A space rock glowing as it enters air."
  },
  {
    "word": "MICROBE",
    "difficulty": "medium",
    "clue": "A living thing so tiny that we need a microscope to see it.",
    "definition": "A tiny living thing seen with a microscope."
  },
  {
    "word": "MINERAL",
    "difficulty": "medium",
    "clue": "A natural solid found inside rocks or in the ground.",
    "definition": "A natural solid found in Earth."
  },
  {
    "word": "MOLECULE",
    "difficulty": "medium",
    "clue": "A tiny group of atoms joined together.",
    "definition": "A tiny group of joined atoms."
  },
  {
    "word": "MUSCLE",
    "difficulty": "medium",
    "clue": "A body part that helps you move and lift things.",
    "definition": "Body tissue that helps create movement."
  },
  {
    "word": "NECTAR",
    "difficulty": "medium",
    "clue": "Sweet liquid inside many flowers that insects and birds drink.",
    "definition": "Sweet flower liquid for some animals."
  },
  {
    "word": "OBSERVE",
    "difficulty": "medium",
    "clue": "To watch something carefully so you can learn about it.",
    "definition": "To watch carefully."
  },
  {
    "word": "OCEAN",
    "difficulty": "medium",
    "clue": "A huge body of salty water that covers much of Earth.",
    "definition": "A very large body of salty water."
  },
  {
    "word": "OMNIVORE",
    "difficulty": "medium",
    "clue": "An animal that eats both plants and other animals.",
    "definition": "An animal that eats plants and animals."
  },
  {
    "word": "PADDLE",
    "difficulty": "medium",
    "clue": "A flat tool used to push a boat through water.",
    "definition": "A flat tool for moving a boat."
  },
  {
    "word": "PATTERN",
    "difficulty": "medium",
    "clue": "A design or order that repeats in a regular way.",
    "definition": "A design or order that repeats."
  },
  {
    "word": "PLANET",
    "difficulty": "medium",
    "clue": "A large round world that travels around a star.",
    "definition": "A large world that travels around a star."
  },
  {
    "word": "RAINBOW",
    "difficulty": "medium",
    "clue": "A band of colors that can appear when sunlight meets raindrops.",
    "definition": "A curved band of sunlight colors."
  },
  {
    "word": "REPTILE",
    "difficulty": "medium",
    "clue": "An animal with scales that usually lays eggs and breathes air.",
    "definition": "A scaly animal that breathes air."
  },
  {
    "word": "ROOT",
    "difficulty": "medium",
    "clue": "The part of a plant that holds it in the soil and takes in water.",
    "definition": "The part of a plant below or in soil."
  },
  {
    "word": "SHELTER",
    "difficulty": "medium",
    "clue": "A place that protects people or animals from weather.",
    "definition": "A place that gives protection."
  },
  {
    "word": "SOLID",
    "difficulty": "medium",
    "clue": "A state of matter that keeps its own shape.",
    "definition": "Matter that keeps its shape."
  },
  {
    "word": "SOUND",
    "difficulty": "medium",
    "clue": "What your ears notice when something vibrates.",
    "definition": "Energy that travels as vibrations we hear."
  },
  {
    "word": "SPACE",
    "difficulty": "medium",
    "clue": "The dark, wide area beyond Earth's air.",
    "definition": "The wide area beyond Earth's air."
  },
  {
    "word": "SPIDER",
    "difficulty": "medium",
    "clue": "A small animal with eight legs that makes silk.",
    "definition": "An eight-legged animal that makes silk."
  },
  {
    "word": "SPIRAL",
    "difficulty": "medium",
    "clue": "A line that curls around and around from a center.",
    "definition": "A curve that winds around a center."
  },
  {
    "word": "STOMACH",
    "difficulty": "medium",
    "clue": "A body organ that helps break down food.",
    "definition": "An organ that helps digest food."
  },
  {
    "word": "STREAM",
    "difficulty": "medium",
    "clue": "A small, flowing body of fresh water.",
    "definition": "A small flowing body of water."
  },
  {
    "word": "TADPOLE",
    "difficulty": "medium",
    "clue": "A young frog that has a tail and lives in water.",
    "definition": "A young frog before it grows legs."
  },
  {
    "word": "TORNADO",
    "difficulty": "medium",
    "clue": "A spinning column of air that reaches down from a storm.",
    "definition": "A narrow, spinning column of storm air."
  },
  {
    "word": "VAPOR",
    "difficulty": "medium",
    "clue": "Water or another liquid changed into a gas.",
    "definition": "A gas made when a liquid changes."
  },
  {
    "word": "VERTEBRATE",
    "difficulty": "medium",
    "clue": "An animal that has a backbone.",
    "definition": "An animal with a backbone."
  },
  {
    "word": "WEATHER",
    "difficulty": "medium",
    "clue": "What the air outside is like today.",
    "definition": "The condition of the air outside."
  },
  {
    "word": "WHISKER",
    "difficulty": "medium",
    "clue": "A stiff hair that helps some animals sense nearby things.",
    "definition": "A stiff hair used for sensing."
  },
  {
    "word": "WINGSPAN",
    "difficulty": "medium",
    "clue": "The distance from one wing tip to the other.",
    "definition": "The distance across both wing tips."
  },
  {
    "word": "WOOL",
    "difficulty": "medium",
    "clue": "Soft, curly fiber that grows on sheep.",
    "definition": "Soft fiber from a sheep's coat."
  },
  {
    "word": "CARNIVORE",
    "difficulty": "medium",
    "clue": "An animal that eats mostly other animals.",
    "definition": "An animal that mainly eats other animals."
  },
  {
    "word": "EVAPORATE",
    "difficulty": "medium",
    "clue": "To slowly change from a liquid into a gas.",
    "definition": "To change slowly from liquid to gas."
  },
  {
    "word": "ADAPT",
    "difficulty": "medium",
    "clue": "To change so you can fit a new place or situation.",
    "definition": "To change to suit new conditions."
  },
  {
    "word": "SCALE",
    "difficulty": "medium",
    "clue": "A thin plate on a fish or reptile, or a tool for weighing.",
    "definition": "A thin body covering or weighing device."
  },
  {
    "word": "ABACUS",
    "difficulty": "hard",
    "clue": "A frame with rows of beads used for counting.",
    "definition": "A counting frame with movable beads."
  },
  {
    "word": "AMPHIBIAN",
    "difficulty": "hard",
    "clue": "An animal that can live on land and in water.",
    "definition": "An animal that can live on land and in water."
  },
  {
    "word": "ARCHIPELAGO",
    "difficulty": "hard",
    "clue": "A group of islands close together.",
    "definition": "A group of nearby islands."
  },
  {
    "word": "BIOME",
    "difficulty": "hard",
    "clue": "A large region with its own climate, plants, and animals.",
    "definition": "A large region with a shared climate and life."
  },
  {
    "word": "CANOPY",
    "difficulty": "hard",
    "clue": "The leafy top layer of a forest.",
    "definition": "The leafy roof of a forest."
  },
  {
    "word": "CANYON",
    "difficulty": "hard",
    "clue": "A deep valley with steep rocky sides.",
    "definition": "A deep valley with steep sides."
  },
  {
    "word": "CRATER",
    "difficulty": "hard",
    "clue": "A bowl-shaped hole made by an impact or eruption.",
    "definition": "A bowl-shaped hole from an impact or eruption."
  },
  {
    "word": "ECLIPSE",
    "difficulty": "hard",
    "clue": "A time when one space object blocks the light from another.",
    "definition": "A time when one space object blocks another's light."
  },
  {
    "word": "EQUATOR",
    "difficulty": "hard",
    "clue": "An imaginary line around the middle of Earth.",
    "definition": "An imaginary line around Earth's middle."
  },
  {
    "word": "FRAGILE",
    "difficulty": "hard",
    "clue": "Easy to break or damage if handled roughly.",
    "definition": "Easy to break or damage."
  },
  {
    "word": "GEYSER",
    "difficulty": "hard",
    "clue": "A hot spring that shoots water and steam into the air.",
    "definition": "A hot spring that sprays water and steam."
  },
  {
    "word": "GLACIER",
    "difficulty": "hard",
    "clue": "A huge, slow-moving river of ice.",
    "definition": "A huge river of moving ice."
  },
  {
    "word": "HABITAT",
    "difficulty": "hard",
    "clue": "The natural home where a plant or animal lives.",
    "definition": "The natural home of a living thing."
  },
  {
    "word": "HORIZON",
    "difficulty": "hard",
    "clue": "The line where the land or sea seems to meet the sky.",
    "definition": "The far line where sky and land seem to meet."
  },
  {
    "word": "LAGOON",
    "difficulty": "hard",
    "clue": "A shallow body of water separated from a larger sea.",
    "definition": "Shallow water separated from a sea."
  },
  {
    "word": "LANTERN",
    "difficulty": "hard",
    "clue": "A portable light inside a protective case.",
    "definition": "A portable light inside a case."
  },
  {
    "word": "MEADOW",
    "difficulty": "hard",
    "clue": "An open field filled with grasses and wild plants.",
    "definition": "An open grassy field."
  },
  {
    "word": "MIGRATE",
    "difficulty": "hard",
    "clue": "To travel from one place to another at a certain season.",
    "definition": "To travel seasonally from one place to another."
  },
  {
    "word": "MONSOON",
    "difficulty": "hard",
    "clue": "A season when a region gets strong, changing winds and heavy rain.",
    "definition": "A seasonal wind that can bring heavy rain."
  },
  {
    "word": "NOURISH",
    "difficulty": "hard",
    "clue": "To give food and care that help a living thing grow.",
    "definition": "To give food and care for growth."
  },
  {
    "word": "ORBIT",
    "difficulty": "hard",
    "clue": "The curved path one space object follows around another.",
    "definition": "The path one space object follows around another."
  },
  {
    "word": "PLANKTON",
    "difficulty": "hard",
    "clue": "Tiny drifting living things that float in water.",
    "definition": "Tiny living things drifting in water."
  },
  {
    "word": "POLLEN",
    "difficulty": "hard",
    "clue": "Fine powder from a flower that helps make new seeds.",
    "definition": "Flower powder that helps plants make seeds."
  },
  {
    "word": "PREDATOR",
    "difficulty": "hard",
    "clue": "An animal that catches other animals for food.",
    "definition": "An animal that catches other animals for food."
  },
  {
    "word": "SCULPTOR",
    "difficulty": "hard",
    "clue": "An artist who shapes materials into statues or figures.",
    "definition": "An artist who makes statues."
  },
  {
    "word": "TUNDRA",
    "difficulty": "hard",
    "clue": "A very cold, treeless region with a short growing season.",
    "definition": "A cold, treeless region."
  },
  {
    "word": "VOLCANO",
    "difficulty": "hard",
    "clue": "An opening in Earth that can send out hot rock and ash.",
    "definition": "An opening that can release hot rock and ash."
  },
  {
    "word": "WHIRLPOOL",
    "difficulty": "hard",
    "clue": "Water spinning quickly around a center.",
    "definition": "Water spinning around a center."
  },
  {
    "word": "WILDERNESS",
    "difficulty": "hard",
    "clue": "A wild natural place with few or no buildings.",
    "definition": "A wild natural area with few buildings."
  },
  {
    "word": "MOSAIC",
    "difficulty": "hard",
    "clue": "A picture made by arranging many small pieces.",
    "definition": "A picture made from many small pieces."
  }
];
export default words;
