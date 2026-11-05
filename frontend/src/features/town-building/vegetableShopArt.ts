export const VEGETABLE_RACK_ART = '/minigames/town-building/vegetable-shop/vegetable-rack-v1.png';

export const VEGETABLE_RACK_SIZE = {width:1024,height:775} as const;

/** Crate centres measured as fractions of vegetable-rack-v1.png. */
export const VEGETABLE_RACK_SLOTS = [
    {x:0.170,y:0.470},
    {x:0.391,y:0.470},
    {x:0.610,y:0.470},
    {x:0.831,y:0.470},
    {x:0.170,y:0.752},
    {x:0.391,y:0.752},
    {x:0.610,y:0.752},
    {x:0.831,y:0.752},
] as const;

export const VEGETABLE_RACK_CROP_ICON_WIDTH = 0.14;

/** Cream floor of each crate in vegetable-rack-v1.png pixels: offsets from the slot centre x, per shelf row. */
export const VEGETABLE_RACK_FLOORS = [
    {top:342,bottom:400,topLeft:-65,topRight:74,bottomLeft:-81,bottomRight:81},
    {top:553,bottom:615,topLeft:-66,topRight:72,bottomLeft:-84,bottomRight:82},
] as const;

/**
 * Full stage-3 plant bounds in crop-growth.png, per CROPS order. The shared garden atlas rects cut the tops of
 * tomato, corn, cabbage and broccoli; these are the whole connected plants.
 */
export const VEGETABLE_CROP_RECTS = [
    [799,9,186,174],[818,193,157,164],[803,368,188,168],[808,550,181,206],
    [798,773,190,175],[790,960,217,176],[796,1147,202,172],[798,1329,194,188],
] as const;
