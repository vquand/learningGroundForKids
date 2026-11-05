import {animalChoices,petCapacity} from '../../../../server/src/town-building/game.ts';
import {uiMessage,uiText} from '../../i18n/uiText';

/** Short, read-aloud friendly descriptions shared by every map's detail card. */
const DESCRIPTIONS:Record<string,string>={
    house:'A cozy home for your family and one pet friend.',
    farmhouse:'A big barn for farm friends: cows, sheep or pigs.',
    coop:'A home for chickens, ducks or geese. Chickens lay eggs and help nearby crops grow.',
    'animal-habitat':'A calm green home for capybaras or rabbits.',
    lemon:'A sunny lemon tree that makes your town greener.',
    apple:'A tall apple tree full of shiny red apples.',
    cherry:'A pretty cherry blossom tree with soft pink flowers.',
    'large-house':'A roomy house where two pet friends can live.',
    infirmary:'A clinic and pharmacy that keeps everyone healthy.',
    school:'A school where a teacher helps children learn.',
    'town-hall':'The heart of your town, with room for three pets.',
    library:'A quiet library full of books to read.',
    'dirt-road':'A simple path that connects your buildings.',
    'rocky-road':'A sturdy stone road that connects your buildings.',
    'vegetable-patch':'A garden for one kind of crop. Harvest when the plants are ripe.',
    'wooden-fence':'A little wooden fence to keep places neat.',
    'halloween-lantern':'Make a lantern with wood and a harvested pumpkin. Place it on grass or a bridge; walkers go around it. Available October 30–31 and put away on November 1.',
    'town-storage':'A cozy pantry barn for crops, milk and fish. Build one to keep up to 1000 of each item and 5000 of each material.',
    'farm-gate':'A swinging farm gate that opens for animals, people and vehicles.',
    'wood-bridge':'A wooden bridge across the water. Start or end it on land.',
    'stone-bridge':'A sturdy stone bridge across the water. Start or end it on land.',
    grocery:'A shop owner sells food here. Help put the groceries on the shelf.',
    bakery:'Bakers make fresh bread every morning. Help fill the bread basket.',
    'meat-shop':'A shop that wraps meat parcels for the town.',
    'vegetable-shop':'A shop full of fresh vegetables from the farms.',
    'tools-smith':'A smith makes and sells tools for building.',
    nursery:'A fish nursery in deep water. Raise baby fish, then collect them.',
    friendly:'A friendly home where grown fish swim and friends visit.',
    'floating-garden':'A floating garden with six water plants. Each healthy plant gives stamina.',
    'insect-raiser':'Raises insects by the shore. Nearby fish grow faster and chickens lay more eggs.',
    'floating-insect-raiser':'Raises insects on the water. Nearby fish grow faster, but floating plants may wither.',
    'snow-snowman':'A happy snowman carved from winter snow. Available from December 20 to January 6.',
    'snow-rabbit':'A cute snow rabbit with long frosty ears. Available from December 20 to January 6.',
    'snow-owl':'A wise snow owl watching over your town. Available from December 20 to January 6.',
    'snow-penguin':'A playful snow penguin ready for icy fun. Available from December 20 to January 6.',
    'snow-fox':'A clever snow fox resting in the cool breeze. Available from December 20 to January 6.',
    'snow-lamb':'A gentle snow lamb with fluffy white fleece. Available from December 20 to January 6.',
    'snow-duckling':'A sweet little snow duckling waddling on the snow. Available from December 20 to January 6.',
    'snow-bear':'A sturdy snow bear keeping winter watch. Available from December 20 to January 6.',
    'snow-tree':'A festive snow pine tree dusted in sparkling frost. Available from December 20 to January 6.',
    'snow-angel':'A peaceful snow angel with spread frosty wings. Available from December 20 to January 6.',
};
/** The localized description, plus the per-building animal or pet hint. */
export function buildingDescription(blueprintId:string):string{
    const parts=[uiText(DESCRIPTIONS[blueprintId]??'')];
    const pets=petCapacity(blueprintId);
    if(pets>0)parts.push(uiMessage('Choose up to {count} pets. Switching is free.',{count:pets}));
    else if(animalChoices(blueprintId).length)parts.push(uiText('Use the animal button to choose who lives here.'));
    return parts.filter(Boolean).join(' ');
}
