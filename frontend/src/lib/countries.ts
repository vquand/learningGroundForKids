// frontend/src/lib/countries.ts
// Country definitions carried forward from the original implementation.

interface CountryInfo {
  name: string;
  continent: string;
}

export const COUNTRY_INFO: Record<string, CountryInfo> = {
  AE: { name: "United Arab Emirates", continent: "Asia" },
  AF: { name: "Afghanistan", continent: "Asia" },
  AL: { name: "Albania", continent: "Europe" },
  DZ: { name: "Algeria", continent: "Africa" },
  AR: { name: "Argentina", continent: "South America" },
  AU: { name: "Australia", continent: "Oceania" },
  AT: { name: "Austria", continent: "Europe" },
  BD: { name: "Bangladesh", continent: "Asia" },
  BE: { name: "Belgium", continent: "Europe" },
  BO: { name: "Bolivia", continent: "South America" },
  BR: { name: "Brazil", continent: "South America" },
  BZ: { name: "Belize", continent: "North America" },
  CA: { name: "Canada", continent: "North America" },
  CL: { name: "Chile", continent: "South America" },
  CN: { name: "China", continent: "Asia" },
  CO: { name: "Colombia", continent: "South America" },
  HR: { name: "Croatia", continent: "Europe" },
  CZ: { name: "Czech Republic", continent: "Europe" },
  DK: { name: "Denmark", continent: "Europe" },
  EC: { name: "Ecuador", continent: "South America" },
  EG: { name: "Egypt", continent: "Africa" },
  ET: { name: "Ethiopia", continent: "Africa" },
  FI: { name: "Finland", continent: "Europe" },
  FR: { name: "France", continent: "Europe" },
  DE: { name: "Germany", continent: "Europe" },
  GH: { name: "Ghana", continent: "Africa" },
  GR: { name: "Greece", continent: "Europe" },
  GT: { name: "Guatemala", continent: "North America" },
  GY: { name: "Guyana", continent: "South America" },
  HT: { name: "Haiti", continent: "North America" },
  HU: { name: "Hungary", continent: "Europe" },
  IN: { name: "India", continent: "Asia" },
  ID: { name: "Indonesia", continent: "Asia" },
  IR: { name: "Iran", continent: "Asia" },
  IS: { name: "Iceland", continent: "Europe" },
  IQ: { name: "Iraq", continent: "Asia" },
  IE: { name: "Ireland", continent: "Europe" },
  IL: { name: "Israel", continent: "Asia" },
  IT: { name: "Italy", continent: "Europe" },
  JP: { name: "Japan", continent: "Asia" },
  JO: { name: "Jordan", continent: "Asia" },
  KH: { name: "Cambodia", continent: "Asia" },
  KZ: { name: "Kazakhstan", continent: "Asia" },
  KE: { name: "Kenya", continent: "Africa" },
  KR: { name: "South Korea", continent: "Asia" },
  MV: { name: "Maldives", continent: "Asia" },
  MY: { name: "Malaysia", continent: "Asia" },
  MX: { name: "Mexico", continent: "North America" },
  MA: { name: "Morocco", continent: "Africa" },
  MM: { name: "Myanmar", continent: "Asia" },
  NP: { name: "Nepal", continent: "Asia" },
  NL: { name: "Netherlands", continent: "Europe" },
  NZ: { name: "New Zealand", continent: "Oceania" },
  NA: { name: "Namibia", continent: "Africa" },
  NG: { name: "Nigeria", continent: "Africa" },
  NO: { name: "Norway", continent: "Europe" },
  PK: { name: "Pakistan", continent: "Asia" },
  PE: { name: "Peru", continent: "South America" },
  PH: { name: "Philippines", continent: "Asia" },
  PL: { name: "Poland", continent: "Europe" },
  PT: { name: "Portugal", continent: "Europe" },
  RO: { name: "Romania", continent: "Europe" },
  RU: { name: "Russia", continent: "Europe" },
  SA: { name: "Saudi Arabia", continent: "Asia" },
  SN: { name: "Senegal", continent: "Africa" },
  SG: { name: "Singapore", continent: "Asia" },
  ZA: { name: "South Africa", continent: "Africa" },
  ES: { name: "Spain", continent: "Europe" },
  LK: { name: "Sri Lanka", continent: "Asia" },
  SE: { name: "Sweden", continent: "Europe" },
  CH: { name: "Switzerland", continent: "Europe" },
  SY: { name: "Syria", continent: "Asia" },
  TW: { name: "Taiwan", continent: "Asia" },
  TH: { name: "Thailand", continent: "Asia" },
  TZ: { name: "Tanzania", continent: "Africa" },
  TR: { name: "Turkey", continent: "Asia" },
  UA: { name: "Ukraine", continent: "Europe" },
  GB: { name: "United Kingdom", continent: "Europe" },
  US: { name: "United States", continent: "North America" },
  UZ: { name: "Uzbekistan", continent: "Asia" },
  VE: { name: "Venezuela", continent: "South America" },
  VN: { name: "Vietnam", continent: "Asia" },
  YE: { name: "Yemen", continent: "Asia" },
  ZW: { name: "Zimbabwe", continent: "Africa" },
};

export const COUNTRY_OPTIONS = Object.entries(COUNTRY_INFO)
  .map(([code, info]) => ({ code, name: info.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function getCountryName(code: string | null | undefined): string {
  if (!code) return "Unknown";
  return COUNTRY_INFO[code.toUpperCase()]?.name ?? code;
}

export function getContinent(code: string | null | undefined): string {
  if (!code) return "Unknown";
  return COUNTRY_INFO[code.toUpperCase()]?.continent ?? "Unknown";
}
