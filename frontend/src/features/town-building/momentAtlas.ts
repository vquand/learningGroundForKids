/** Measured isolated-subject crops (alpha > 8) for the animal-interaction artwork.
 * Babies and fleece sheets share the farm animal pose order: side stand, side step,
 * front stand, front step, back stand, back step, sleeping, extra (duckling swim,
 * chick peck, lamb hop, sheep huddle ball). Provenance: ANIMAL_INTERACTIONS_ASSETS.md. */
export const MOMENT_ATLASES={
    /** Pig forage props, seasonal server bushes and distinct Highland yarn (measured alpha bounds). */
    'mushroom-v1':{width:1774,height:887,rects:[[203,198,586,535],[986,205,585,524]]},
    'flower-bush-v1':{width:2172,height:724,rects:[[57,224,469,321],[591,223,464,322],[1112,227,466,314],[1655,211,466,332]]},
    'highland-yarn-v1':{width:1402,height:1122,rects:[[192,291,1099,570]]},

    'baby-duckling-v1':{width:2048,height:1024,rects:[[83,79,345,355],[592,78,351,356],[1145,78,270,355],[1657,77,270,358],[130,593,253,350],[640,592,255,351],[1102,622,355,291],[1620,620,344,296]]},
    'baby-chick-v1':{width:2048,height:1024,rects:[[94,80,323,351],[603,77,330,358],[1142,78,276,357],[1655,77,274,358],[110,593,291,350],[624,593,288,350],[1106,620,348,296],[1621,638,342,259]]},
    'baby-gosling-v1':{width:2048,height:1024,rects:[[99,101,314,319],[610,95,315,325],[1175,99,209,321],[1687,99,210,321],[142,607,227,325],[655,607,226,325],[1110,692,340,240],[1618,671,347,261]]},
    'baby-lamb-v1':{width:2048,height:1024,rects:[[86,94,340,324],[600,95,335,322],[1122,92,316,327],[1636,91,312,329],[99,602,312,332],[610,601,315,333],[1101,633,358,270],[1624,613,335,309]]},
    'sheep-fleece-medium-v1':{width:2048,height:1024,rects:[[103,123,295,250],[611,122,304,250],[1142,111,274,274],[1657,111,273,274],[117,594,263,310],[641,595,261,309],[1122,644,314,219],[1640,599,303,263]]},
    /** Shorn sheep: equal 4x2 cells, same pose order (cell 8 is the huddle ball). Optional art: see townImageFiles OPTIONAL_TOWN_FILES. */
    /** Thin shorn v2 and blade shears: measured alpha > 8 after cell assembly. */
    'sheep-sheared-v2':{width:2048,height:1024,rects:[[90,112,333,260],[596,112,345,259],[1148,105,263,281],[1661,104,262,281],[138,606,235,298],[650,604,235,300],[1104,677,351,187],[1632,672,319,192]]},
    'shears-v1':{width:512,height:512,rects:[[60,64,416,382]]},
    'sheep-fleece-full-v1':{width:2048,height:1024,rects:[[86,98,326,273],[599,95,339,278],[1120,74,309,310],[1633,72,308,312],[120,575,281,327],[632,575,284,327],[1094,622,344,242],[1613,569,336,294]]},
    /** Milk bottle, milk can, wool ball, feed bowl, ladybug, caterpillar. */
    'animal-icons-v1':{width:3072,height:512,rects:[[151,77,209,357],[599,77,337,358],[1101,88,358,336],[1613,136,358,240],[2129,77,349,358],[2637,118,358,275]]},
    'town-storage-v1':{width:1024,height:1024,rects:[[143,181,737,662]]},
    'town-storage-icon-v1':{width:1024,height:1024,rects:[[143,234,737,555]]},
    /** Rows spring, summer, autumn, winter; columns stub, sprout, medium, tall. One shared scale keeps growth visible. */
    'grass-tufts-v1':{width:1024,height:1024,rects:[[102,192,51,24],[352,172,64,44],[589,138,102,78],[811,60,170,156],[104,448,47,24],[352,428,63,44],[589,394,101,78],[811,316,170,156],[104,704,47,24],[352,684,63,44],[589,650,101,78],[810,572,172,156],[105,960,45,24],[352,940,63,44],[588,906,104,78],[808,831,176,153]]},
    /** Pile, scattered pile, three loose leaves. */
    'leaf-piles-v1':{width:1536,height:512,rects:[[82,220,348,190],[589,131,358,279],[1152,147,256,217]]},
    /** Swimming: side paddle cycle (neck forward, upright, back, upright), front x2, back x2; flat waterline at the bottom, no feet. */
    'duck-swim-v1':{width:2048,height:1024,rects:[[96,194,338,197],[609,186,310,205],[1121,185,298,206],[1633,188,308,203],[117,671,278,232],[627,623,282,280],[1154,665,252,238],[1665,641,254,262]]},
    'goose-swim-v1':{width:2048,height:1024,rects:[[77,185,357,226],[589,162,262,249],[1101,174,237,237],[1613,162,258,249],[139,689,233,234],[652,649,231,274],[1166,681,228,242],[1678,647,228,276]]},
    'gosling-swim-v1':{width:2048,height:1024,rects:[[68,159,376,251],[580,147,340,263],[1092,171,360,239],[1604,146,356,264],[119,695,274,227],[631,657,273,265],[1141,694,277,228],[1654,647,275,275]]},
    'duckling-swim-v1':{width:2048,height:1024,rects:[[84,180,345,231],[595,172,298,239],[1106,181,296,230],[1615,170,301,241],[130,710,251,213],[644,688,249,235],[1156,710,249,213],[1668,686,249,237]]},
} as const;
export type MomentFile=keyof typeof MOMENT_ATLASES;
