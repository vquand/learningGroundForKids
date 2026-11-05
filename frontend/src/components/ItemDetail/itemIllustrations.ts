import type { ItemDetail } from '../../types/item';

const generatedCategoryIllustrationPaths: Record<string, string> = {
  animal: '/item-category-illustrations/animal.webp',
  food: '/item-category-illustrations/food.webp',
  landmark: '/item-category-illustrations/landmark.webp',
  monument: '/item-category-illustrations/monument.webp',
  phenomenon: '/item-category-illustrations/phenomenon.webp',
  music: '/item-category-illustrations/music.webp',
  movie: '/item-category-illustrations/movie.webp',
};

export function generatedCategoryIllustrationPath(category: string): string | undefined {
  return generatedCategoryIllustrationPaths[category];
}

type Palette = {
  skyTop: string;
  skyBottom: string;
  accent: string;
  accentSoft: string;
  ink: string;
  light: string;
};

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function normalizeText(item: ItemDetail): string {
  return [
    item.translation?.title ?? '',
    item.translation?.description ?? '',
    item.translation?.history ?? '',
    item.category,
  ]
    .join(' ')
    .toLowerCase();
}

function hasAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

function paletteForItem(item: ItemDetail): Palette {
  const seed = hashString(`${item.category}:${item.translation?.title ?? 'untitled'}`);
  const palettesByCategory: Record<string, Palette[]> = {
    food: [
      { skyTop: '#fff2d8', skyBottom: '#ffd6b3', accent: '#f97316', accentSoft: '#fdba74', ink: '#7c2d12', light: '#fff7ed' },
      { skyTop: '#ffe7cc', skyBottom: '#ffc7a1', accent: '#ef4444', accentSoft: '#fca5a5', ink: '#7f1d1d', light: '#fff1f2' },
    ],
    phenomenon: [
      { skyTop: '#dff3ff', skyBottom: '#cfd9ff', accent: '#38bdf8', accentSoft: '#bae6fd', ink: '#1e3a8a', light: '#ffffff' },
      { skyTop: '#eaf8ff', skyBottom: '#d8d5ff', accent: '#6366f1', accentSoft: '#c7d2fe', ink: '#312e81', light: '#ffffff' },
    ],
    landmark: [
      { skyTop: '#e3fff0', skyBottom: '#c7f3df', accent: '#10b981', accentSoft: '#a7f3d0', ink: '#14532d', light: '#f0fdf4' },
      { skyTop: '#def7ff', skyBottom: '#caefe8', accent: '#14b8a6', accentSoft: '#99f6e4', ink: '#134e4a', light: '#f0fdfa' },
    ],
    monument: [
      { skyTop: '#ebf4ff', skyBottom: '#dbeafe', accent: '#3b82f6', accentSoft: '#93c5fd', ink: '#1e3a8a', light: '#eff6ff' },
      { skyTop: '#eef2ff', skyBottom: '#dbeafe', accent: '#6366f1', accentSoft: '#c7d2fe', ink: '#312e81', light: '#eef2ff' },
    ],
    music: [
      { skyTop: '#f5e8ff', skyBottom: '#e9d5ff', accent: '#a855f7', accentSoft: '#d8b4fe', ink: '#581c87', light: '#faf5ff' },
      { skyTop: '#ffe7fb', skyBottom: '#f5d0fe', accent: '#d946ef', accentSoft: '#f0abfc', ink: '#86198f', light: '#fdf4ff' },
    ],
    movie: [
      { skyTop: '#ffe4ec', skyBottom: '#ffd3b4', accent: '#ec4899', accentSoft: '#f9a8d4', ink: '#831843', light: '#fff1f2' },
      { skyTop: '#ffe5d6', skyBottom: '#ffd7ef', accent: '#f97316', accentSoft: '#fdba74', ink: '#9a3412', light: '#fff7ed' },
    ],
    animal: [
      { skyTop: '#efe4ff', skyBottom: '#ddd6fe', accent: '#8b5cf6', accentSoft: '#c4b5fd', ink: '#4c1d95', light: '#f5f3ff' },
      { skyTop: '#ececff', skyBottom: '#dbeafe', accent: '#6366f1', accentSoft: '#a5b4fc', ink: '#3730a3', light: '#eef2ff' },
    ],
  };
  const palettes = palettesByCategory[item.category] ?? palettesByCategory.monument!;
  return palettes[seed % palettes.length]!;
}

function baseScene(palette: Palette): string {
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${palette.skyTop}" />
        <stop offset="100%" stop-color="${palette.skyBottom}" />
      </linearGradient>
    </defs>
    <rect width="1200" height="640" rx="48" fill="url(#bg)" />
    <circle cx="1060" cy="118" r="96" fill="${palette.light}" opacity="0.35" />
    <circle cx="150" cy="520" r="120" fill="${palette.light}" opacity="0.18" />
    <circle cx="980" cy="500" r="80" fill="${palette.light}" opacity="0.18" />
  `;
}

function cloud(x: number, y: number, scale: number, color = '#ffffff', opacity = 0.7): string {
  return `
    <g opacity="${opacity}">
      <circle cx="${x}" cy="${y}" r="${36 * scale}" fill="${color}" />
      <circle cx="${x + 34 * scale}" cy="${y - 12 * scale}" r="${28 * scale}" fill="${color}" />
      <circle cx="${x + 66 * scale}" cy="${y}" r="${34 * scale}" fill="${color}" />
      <rect x="${x - 4 * scale}" y="${y}" width="${74 * scale}" height="${26 * scale}" rx="${13 * scale}" fill="${color}" />
    </g>
  `;
}

function sparkle(x: number, y: number, color: string): string {
  return `
    <g opacity="0.6">
      <circle cx="${x}" cy="${y}" r="4" fill="${color}" />
      <path d="M${x} ${y - 16} L${x} ${y + 16} M${x - 16} ${y} L${x + 16} ${y}" stroke="${color}" stroke-width="4" stroke-linecap="round" />
    </g>
  `;
}

function foodScene(text: string, palette: Palette): string {
  if (hasAny(text, ['pho', 'laksa', 'ramen', 'bun bo', 'soup'])) {
    return `
      ${baseScene(palette)}
      ${cloud(170, 120, 1.1)}
      <ellipse cx="600" cy="420" rx="250" ry="120" fill="#9a3412" opacity="0.15" />
      <path d="M390 250 C430 420 770 420 810 250" fill="${palette.light}" stroke="#b45309" stroke-width="18" />
      <path d="M430 280 C470 360 730 360 770 280" fill="#f59e0b" opacity="0.55" />
      <path d="M455 250 C470 315 520 330 540 275 C555 330 605 345 625 280 C645 335 700 335 725 268" fill="none" stroke="#f8fafc" stroke-width="10" stroke-linecap="round" />
      <path d="M700 188 L800 120" stroke="#92400e" stroke-width="12" stroke-linecap="round" />
      <path d="M744 198 L844 130" stroke="#92400e" stroke-width="12" stroke-linecap="round" />
      <circle cx="530" cy="250" r="14" fill="#22c55e" />
      <circle cx="610" cy="235" r="12" fill="#16a34a" />
      <circle cx="665" cy="264" r="10" fill="#84cc16" />
      ${sparkle(910, 180, palette.accent)}
    `;
  }

  if (hasAny(text, ['pizza'])) {
    return `
      ${baseScene(palette)}
      ${cloud(180, 110, 1)}
      <path d="M400 160 L830 250 L510 500 Z" fill="#fbbf24" stroke="#b45309" stroke-width="18" stroke-linejoin="round" />
      <path d="M418 175 L808 257" stroke="#fef3c7" stroke-width="28" stroke-linecap="round" />
      <circle cx="565" cy="275" r="24" fill="#ef4444" />
      <circle cx="662" cy="305" r="20" fill="#ef4444" />
      <circle cx="590" cy="370" r="22" fill="#ef4444" />
    `;
  }

  if (hasAny(text, ['satay', 'kebab', 'shawarma', 'bbq', 'ribs'])) {
    return `
      ${baseScene(palette)}
      ${cloud(220, 120, 1)}
      <path d="M360 430 C460 330 650 330 780 430" fill="none" stroke="#92400e" stroke-width="18" stroke-linecap="round" />
      <path d="M420 260 L760 380" stroke="#78350f" stroke-width="16" stroke-linecap="round" />
      <circle cx="500" cy="292" r="34" fill="#fb923c" />
      <circle cx="590" cy="325" r="34" fill="#f97316" />
      <circle cx="675" cy="355" r="34" fill="#ea580c" />
    `;
  }

  if (hasAny(text, ['dumpling', 'pierogi', 'momo', 'gyoza'])) {
    return `
      ${baseScene(palette)}
      <ellipse cx="600" cy="430" rx="250" ry="105" fill="#ffffff" opacity="0.65" />
      <path d="M430 340 C470 280 540 280 580 340 C540 378 470 378 430 340" fill="#f8fafc" stroke="#cbd5e1" stroke-width="10" />
      <path d="M540 300 C585 235 665 235 710 300 C665 343 585 343 540 300" fill="#f8fafc" stroke="#cbd5e1" stroke-width="10" />
      <path d="M630 370 C680 305 770 305 820 370 C770 415 680 415 630 370" fill="#f8fafc" stroke="#cbd5e1" stroke-width="10" />
    `;
  }

  return `
    ${baseScene(palette)}
    <ellipse cx="600" cy="430" rx="250" ry="120" fill="#ffffff" opacity="0.68" />
    <ellipse cx="600" cy="410" rx="220" ry="90" fill="#fde68a" />
    <circle cx="500" cy="390" r="16" fill="#ef4444" />
    <circle cx="620" cy="360" r="14" fill="#22c55e" />
    <circle cx="710" cy="400" r="18" fill="#f97316" />
  `;
}

function phenomenonScene(text: string, palette: Palette): string {
  if (hasAny(text, ['sun halo'])) {
    return `
      ${baseScene(palette)}
      ${cloud(180, 160, 1.05)}
      ${cloud(820, 140, 1.15, '#ffffff', 0.55)}
      <circle cx="600" cy="300" r="74" fill="#fde68a" />
      <circle cx="600" cy="300" r="146" fill="none" stroke="#ffffff" stroke-width="16" opacity="0.8" />
      <circle cx="600" cy="300" r="188" fill="none" stroke="${palette.accentSoft}" stroke-width="10" opacity="0.7" />
      <path d="M600 182 L600 120 M518 210 L474 164 M682 210 L726 164 M490 300 L428 300 M710 300 L772 300" stroke="#ffffff" stroke-width="10" stroke-linecap="round" />
    `;
  }

  if (hasAny(text, ['aurora'])) {
    return `
      ${baseScene(palette)}
      <rect y="380" width="1200" height="260" fill="#1e293b" />
      <path d="M120 180 C260 80 350 280 520 170 C680 70 760 250 960 160 C1030 125 1090 115 1140 140" fill="none" stroke="#86efac" stroke-width="28" stroke-linecap="round" opacity="0.75" />
      <path d="M90 240 C250 130 400 320 560 230 C700 150 820 320 1020 220" fill="none" stroke="#67e8f9" stroke-width="20" stroke-linecap="round" opacity="0.6" />
      ${sparkle(210, 110, '#ffffff')}
      ${sparkle(980, 90, '#ffffff')}
    `;
  }

  if (hasAny(text, ['rainbow'])) {
    return `
      ${baseScene(palette)}
      ${cloud(200, 400, 1.2)}
      ${cloud(760, 400, 1.15)}
      <path d="M260 450 A340 340 0 0 1 940 450" fill="none" stroke="#ef4444" stroke-width="18" />
      <path d="M295 450 A305 305 0 0 1 905 450" fill="none" stroke="#f59e0b" stroke-width="18" />
      <path d="M330 450 A270 270 0 0 1 870 450" fill="none" stroke="#facc15" stroke-width="18" />
      <path d="M365 450 A235 235 0 0 1 835 450" fill="none" stroke="#22c55e" stroke-width="18" />
      <path d="M400 450 A200 200 0 0 1 800 450" fill="none" stroke="#38bdf8" stroke-width="18" />
      <path d="M435 450 A165 165 0 0 1 765 450" fill="none" stroke="#6366f1" stroke-width="18" />
    `;
  }

  if (hasAny(text, ['tsunami', 'waterspout', 'wave', 'flood'])) {
    return `
      ${baseScene(palette)}
      <path d="M240 430 C350 240 560 210 720 310 C820 370 880 430 980 470 C860 530 700 555 530 540 C390 525 290 490 240 430 Z" fill="${palette.accent}" opacity="0.9" />
      <path d="M300 410 C410 340 540 330 630 360 C555 300 520 230 560 170 C655 255 770 335 905 400" fill="none" stroke="${palette.light}" stroke-width="14" stroke-linecap="round" />
    `;
  }

  if (hasAny(text, ['tornado', 'cyclone', 'hurricane', 'typhoon', 'dust devil', 'dust storm', 'sirocco', 'derecho'])) {
    return `
      ${baseScene(palette)}
      ${cloud(210, 110, 1.1)}
      ${cloud(760, 120, 1)}
      <path d="M610 150 C760 160 730 260 640 320 C560 372 565 420 600 540" fill="none" stroke="${palette.accent}" stroke-width="34" stroke-linecap="round" />
      <path d="M545 160 C660 180 650 245 590 290 C530 335 530 405 558 500" fill="none" stroke="${palette.light}" stroke-width="16" stroke-linecap="round" opacity="0.75" />
    `;
  }

  return `
    ${baseScene(palette)}
    ${cloud(240, 160, 1.1)}
    ${cloud(740, 150, 1.15)}
    <circle cx="600" cy="290" r="92" fill="${palette.accentSoft}" opacity="0.85" />
    <circle cx="600" cy="290" r="156" fill="none" stroke="${palette.light}" stroke-width="16" opacity="0.8" />
    ${sparkle(920, 140, palette.light)}
  `;
}

function landmarkScene(text: string, palette: Palette): string {
  if (hasAny(text, ['falls', 'waterfall'])) {
    return `
      ${baseScene(palette)}
      <rect y="420" width="1200" height="220" fill="#1d4ed8" opacity="0.22" />
      <path d="M280 130 L280 500" stroke="#ffffff" stroke-width="120" stroke-linecap="round" opacity="0.75" />
      <path d="M490 110 L490 500" stroke="#dbeafe" stroke-width="140" stroke-linecap="round" opacity="0.72" />
      <path d="M730 150 L730 500" stroke="#ffffff" stroke-width="100" stroke-linecap="round" opacity="0.74" />
    `;
  }

  if (hasAny(text, ['cave', 'cavern', 'son doong', 'waitomo'])) {
    return `
      ${baseScene(palette)}
      <path d="M120 520 C180 300 320 180 480 190 C620 200 720 130 860 170 C980 205 1070 320 1110 520 Z" fill="#334155" />
      <path d="M360 520 C420 440 500 390 600 385 C700 380 790 435 860 520 Z" fill="${palette.skyBottom}" />
      <circle cx="340" cy="230" r="8" fill="#86efac" />
      <circle cx="390" cy="260" r="6" fill="#86efac" />
      <circle cx="865" cy="255" r="7" fill="#93c5fd" />
    `;
  }

  if (hasAny(text, ['desert', 'dunes', 'sahara', 'namib', 'white desert'])) {
    return `
      ${baseScene(palette)}
      <circle cx="880" cy="150" r="70" fill="#fde68a" />
      <path d="M90 480 C230 360 390 360 520 460 C660 560 820 560 1100 420 L1100 640 L90 640 Z" fill="#fbbf24" opacity="0.72" />
      <path d="M140 520 C300 390 480 385 650 510 C760 590 900 585 1110 470" fill="none" stroke="#fdba74" stroke-width="48" stroke-linecap="round" />
    `;
  }

  return `
    ${baseScene(palette)}
    <circle cx="890" cy="140" r="68" fill="#fde68a" />
    <polygon points="180,520 340,250 500,520" fill="#475569" />
    <polygon points="390,520 610,180 840,520" fill="#334155" />
  `;
}

function monumentScene(text: string, palette: Palette): string {
  if (hasAny(text, ['tower', 'eiffel', 'pisa', 'burj', 'petronas'])) {
    return `
      ${baseScene(palette)}
      <path d="M600 120 L520 520 L680 520 Z" fill="${palette.accent}" opacity="0.88" />
      <path d="M555 220 L645 220 M540 300 L660 300 M525 380 L675 380" stroke="${palette.light}" stroke-width="12" stroke-linecap="round" />
    `;
  }

  if (hasAny(text, ['pyramid', 'giza', 'teotihuacan'])) {
    return `
      ${baseScene(palette)}
      <polygon points="310,520 520,220 730,520" fill="#d6a74f" />
      <polygon points="530,520 690,280 880,520" fill="#b88732" />
      <circle cx="900" cy="150" r="70" fill="#fde68a" />
    `;
  }

  return `
    ${baseScene(palette)}
    <rect x="350" y="250" width="500" height="240" rx="24" fill="${palette.accentSoft}" />
    <path d="M330 270 L470 150 L610 270 L750 150 L870 270" fill="${palette.accent}" />
    <rect x="540" y="330" width="120" height="160" rx="60" fill="${palette.light}" />
  `;
}

function animalScene(text: string, palette: Palette): string {
  if (hasAny(text, ['elephant'])) {
    return `
      ${baseScene(palette)}
      <ellipse cx="610" cy="360" rx="200" ry="140" fill="${palette.accentSoft}" />
      <circle cx="470" cy="325" r="82" fill="${palette.accent}" />
      <ellipse cx="410" cy="350" rx="55" ry="85" fill="${palette.accentSoft}" />
      <path d="M370 355 C315 400 330 500 410 505" fill="none" stroke="${palette.accent}" stroke-width="24" stroke-linecap="round" />
    `;
  }

  if (hasAny(text, ['whale', 'dolphin', 'seal'])) {
    return `
      ${baseScene(palette)}
      <path d="M260 360 C360 250 520 240 700 300 C820 340 890 350 980 320 C930 390 900 455 930 505 C860 490 805 465 760 440 C640 500 430 510 260 360 Z" fill="${palette.accent}" />
      <path d="M840 335 C910 300 960 300 1010 345" fill="none" stroke="${palette.accentSoft}" stroke-width="18" stroke-linecap="round" />
    `;
  }

  if (hasAny(text, ['dinosaur', 'rex', 'triceratops', 'brachiosaurus', 'ankylosaurus', 'diplodocus', 'velociraptor', 'stegosaurus', 'spinosaurus', 'iguanodon', 'pterodactylus'])) {
    return `
      ${baseScene(palette)}
      <path d="M280 430 C360 300 510 250 650 290 C780 330 860 410 930 410 C900 470 835 515 770 520 C742 462 708 430 650 430 L510 430 L500 530 L445 530 L450 430 L360 430 L340 530 L285 530 Z" fill="${palette.accent}" />
    `;
  }

  return `
    ${baseScene(palette)}
    <circle cx="600" cy="310" r="150" fill="${palette.accent}" />
    <circle cx="470" cy="220" r="52" fill="${palette.accentSoft}" />
    <circle cx="730" cy="220" r="52" fill="${palette.accentSoft}" />
    <circle cx="540" cy="300" r="16" fill="${palette.ink}" />
    <circle cx="660" cy="300" r="16" fill="${palette.ink}" />
    <ellipse cx="600" cy="380" rx="65" ry="45" fill="${palette.light}" />
  `;
}

function musicScene(text: string, palette: Palette): string {
  if (hasAny(text, ['twinkle', 'star'])) {
    return `
      ${baseScene(palette)}
      <polygon points="600,130 640,220 735,230 665,295 685,390 600,340 515,390 535,295 465,230 560,220" fill="${palette.light}" />
      ${sparkle(340, 180, palette.light)}
      ${sparkle(880, 170, palette.light)}
    `;
  }

  return `
    ${baseScene(palette)}
    <path d="M520 180 L520 420" stroke="${palette.accent}" stroke-width="22" stroke-linecap="round" />
    <path d="M690 160 L690 390" stroke="${palette.accent}" stroke-width="22" stroke-linecap="round" />
    <path d="M520 180 C575 205 630 205 690 160" fill="none" stroke="${palette.accentSoft}" stroke-width="18" stroke-linecap="round" />
    <circle cx="470" cy="430" r="50" fill="${palette.accent}" />
    <circle cx="640" cy="400" r="50" fill="${palette.accent}" />
  `;
}

function movieScene(text: string, palette: Palette): string {
  if (hasAny(text, ['lion'])) {
    return `
      ${baseScene(palette)}
      <circle cx="900" cy="160" r="70" fill="#fde68a" />
      <path d="M90 500 C260 410 410 410 570 470 C700 520 870 520 1110 470 L1110 640 L90 640 Z" fill="#f59e0b" opacity="0.5" />
      <circle cx="600" cy="300" r="120" fill="${palette.accent}" />
      <circle cx="520" cy="230" r="46" fill="${palette.accentSoft}" />
      <circle cx="680" cy="230" r="46" fill="${palette.accentSoft}" />
    `;
  }

  if (hasAny(text, ['mermaid', 'ponyo'])) {
    return `
      ${baseScene(palette)}
      <path d="M290 470 C410 300 690 300 820 470 C700 525 530 545 390 525 Z" fill="${palette.accent}" opacity="0.86" />
      <circle cx="600" cy="230" r="74" fill="${palette.accentSoft}" />
      <path d="M540 350 C600 390 650 450 665 530" fill="none" stroke="${palette.accentSoft}" stroke-width="28" stroke-linecap="round" />
    `;
  }

  return `
    ${baseScene(palette)}
    <rect x="430" y="210" width="340" height="200" rx="22" fill="${palette.accent}" />
    <path d="M520 260 L520 360 L620 310 Z" fill="${palette.light}" />
    ${sparkle(930, 170, palette.light)}
  `;
}

function buildIllustrationSvg(item: ItemDetail): string {
  const text = normalizeText(item);
  const palette = paletteForItem(item);
  const sceneByCategory: Record<string, () => string> = {
    food: () => foodScene(text, palette),
    phenomenon: () => phenomenonScene(text, palette),
    landmark: () => landmarkScene(text, palette),
    monument: () => monumentScene(text, palette),
    animal: () => animalScene(text, palette),
    music: () => musicScene(text, palette),
    movie: () => movieScene(text, palette),
  };

  const scene = sceneByCategory[item.category]?.() ?? `${baseScene(palette)}${sparkle(920, 170, palette.light)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 640" role="img" aria-label="Illustration cover">${scene}</svg>`;
}

export function createItemIllustrationDataUri(item: ItemDetail): string {
  const svg = buildIllustrationSvg(item);
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
