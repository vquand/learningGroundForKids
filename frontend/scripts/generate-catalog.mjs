import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// The generated catalog is deliberately data-only. Keeping the source list in
// one file makes the next content review repeatable without editing 200 JSON
// files by hand.
const fossils = [
  ["Ammonite", "MA", 32.9, 35.9, -180000000, "mya", "Morocco"],
  ["Archaeopteryx", "DE", 49.0, 11.4, -150000000, "mya", "Germany"],
  ["Acanthostega", "GL", 70.7, -52.0, -365000000, "mya", "Greenland"],
  ["Anomalocaris", "CA", 51.2, -116.7, -505000000, "mya", "Canada"],
  ["Australopithecus afarensis", "ET", 11.1, 40.6, -3200000, "mya", "Ethiopia"],
  ["Basilosaurus", "US", 32.8, -87.8, -40000000, "mya", "Alabama, United States"],
  ["Dunkleosteus", "US", 41.7, -83.5, -380000000, "mya", "Ohio, United States"],
  ["Edmontosaurus", "CA", 53.5, -113.5, -73000000, "mya", "Alberta, Canada"],
  ["Elasmosaurus", "US", 38.5, -98.0, -80000000, "mya", "Kansas, United States"],
  ["Eurypterid", "US", 42.8, -73.9, -430000000, "mya", "New York, United States"],
  ["Hallucigenia", "CA", 51.2, -116.7, -505000000, "mya", "British Columbia, Canada"],
  ["Ichthyosaurus", "GB", 50.7, -2.3, -190000000, "mya", "Dorset, United Kingdom"],
  ["Livyatan", "PE", -14.1, -75.7, -13000000, "mya", "Peru"],
  ["Megalodon", "US", 34.2, -77.9, -15000000, "mya", "North Carolina, United States"],
  ["Microraptor", "CN", 41.8, 122.1, -125000000, "mya", "Liaoning, China"],
  ["Mosasaurus", "NL", 50.8, 5.7, -68000000, "mya", "Maastricht, Netherlands"],
  ["Opabinia", "CA", 51.2, -116.7, -505000000, "mya", "British Columbia, Canada"],
  ["Paraceratherium", "KZ", 48.0, 67.0, -30000000, "mya", "Kazakhstan"],
  ["Plesiosaurus", "GB", 50.7, -2.3, -200000000, "mya", "Dorset, United Kingdom"],
  ["Plioplatecarpus", "US", 38.5, -98.0, -80000000, "mya", "Kansas, United States"],
  ["Postosuchus", "US", 35.2, -80.8, -225000000, "mya", "North Carolina, United States"],
  ["Protoceratops", "MN", 43.6, 103.7, -75000000, "mya", "Mongolia"],
  ["Psittacosaurus", "CN", 41.8, 122.1, -120000000, "mya", "Liaoning, China"],
  ["Quetzalcoatlus", "US", 32.3, -97.1, -68000000, "mya", "Texas, United States"],
  ["Sarcosuchus", "NE", 17.6, 8.1, -112000000, "mya", "Niger"],
  ["Sinosauropteryx", "CN", 41.8, 122.1, -130000000, "mya", "Liaoning, China"],
  ["Smilodon", "AR", -34.6, -58.4, -12000, "mya", "Argentina"],
  ["Tiktaalik", "CA", 70.7, -52.0, -375000000, "mya", "Nunavut, Canada"],
  ["Titanoboa", "CO", 8.7, -74.8, -60000000, "mya", "Colombia"],
  ["Utahraptor", "US", 38.8, -111.6, -125000000, "mya", "Utah, United States"],
  ["Woolly Mammoth", "RU", 68.9, 33.1, -10000, "mya", "Siberia, Russia"],
  ["Xiphactinus", "US", 38.5, -98.0, -87000000, "mya", "Kansas, United States"],
  ["Yi qi", "CN", 41.8, 122.1, -160000000, "mya", "Hebei, China"],
  ["Yutyrannus", "CN", 41.8, 122.1, -125000000, "mya", "Liaoning, China"],
  ["Deinosuchus", "US", 29.7, -95.4, -82000000, "mya", "Texas, United States"],
  ["Dodo remains", "MU", -20.2, 57.5, 1681, "year", "Mauritius"],
  ["Homo naledi", "ZA", -26.0, 27.7, -250000, "mya", "South Africa"],
  ["Homo erectus", "ID", -7.8, 110.4, -700000, "mya", "Java, Indonesia"],
  ["Megatherium", "AR", -34.6, -58.4, -10000, "mya", "Argentina"],
  ["Nothosaurus", "CN", 34.3, 108.9, -240000000, "mya", "China"],
  ["Onychonycteris", "US", 41.1, -110.7, -52000000, "mya", "Wyoming, United States"],
  ["Placoderm", "AU", -31.9, 115.9, -400000000, "mya", "Western Australia"],
  ["Pikaia", "CA", 51.2, -116.7, -505000000, "mya", "British Columbia, Canada"],
  ["Quagga remains", "ZA", -33.9, 18.4, 1883, "year", "South Africa"],
  ["Rhamphorhynchus", "DE", 49.0, 11.4, -150000000, "mya", "Bavaria, Germany"],
  ["Shonisaurus", "US", 39.3, -117.0, -215000000, "mya", "Nevada, United States"],
  ["Thrinaxodon", "ZA", -30.6, 22.9, -245000000, "mya", "South Africa"],
  ["Uintatherium", "US", 41.1, -110.7, -45000000, "mya", "Wyoming, United States"],
  ["Waptia", "CA", 51.2, -116.7, -505000000, "mya", "British Columbia, Canada"],
  ["Zephyrosaurus", "US", 45.8, -108.5, -110000000, "mya", "Montana, United States"],
];

const foods = [
  ["Ajiaco", "CO", 4.7, -74.1, -500, "century", "Colombia"],
  ["Akara", "NG", 6.5, 3.4, -1000, "century", "West Africa"],
  ["Amok", "KH", 11.6, 104.9, 1200, "century", "Cambodia"],
  ["Aloo Gobi", "IN", 28.6, 77.2, 1700, "century", "India"],
  ["Arancini", "IT", 37.5, 15.1, 900, "century", "Sicily, Italy"],
  ["Asado", "AR", -34.6, -58.4, 1600, "century", "Argentina"],
  ["Borscht", "UA", 50.5, 30.5, 1400, "century", "Ukraine"],
  ["Bánh Xèo", "VN", 10.8, 106.6, 1700, "century", "Vietnam"],
  ["Bouillabaisse", "FR", 43.3, 5.4, 1800, "century", "Marseille, France"],
  ["Chakalaka", "ZA", -26.2, 28.0, 1900, "century", "South Africa"],
  ["Churrasco", "BR", -23.6, -46.6, 1500, "century", "Brazil"],
  ["Couscous", "TN", 36.8, 10.2, -2000, "century", "North Africa"],
  ["Dosa", "IN", 13.1, 80.3, 1000, "century", "South India"],
  ["Feijoada", "BR", -22.9, -43.2, 1700, "century", "Brazil"],
  ["Fufu", "GH", 5.6, -0.2, 1000, "century", "West Africa"],
  ["Gallo Pinto", "CR", 9.9, -84.1, 1800, "century", "Costa Rica"],
  ["Gnocchi", "IT", 45.5, 9.2, 1500, "century", "Italy"],
  ["Gulab Jamun", "IN", 28.6, 77.2, 1100, "century", "India"],
  ["Hainanese Chicken Rice", "SG", 1.3, 103.8, 1900, "century", "Singapore"],
  ["Jerk Chicken", "JM", 18.1, -77.3, 1600, "century", "Jamaica"],
  ["Kachori", "IN", 26.9, 75.8, 1700, "century", "Rajasthan, India"],
  ["Khachapuri", "GE", 41.7, 44.8, 1000, "century", "Georgia"],
  ["Kibbeh", "LB", 33.9, 35.5, -1000, "century", "Levant"],
  ["Kimchi", "KR", 37.6, 127.0, 600, "century", "Korea"],
  ["Koshari", "EG", 30.0, 31.2, 1800, "century", "Egypt"],
  ["Lángos", "HU", 47.5, 19.0, 1500, "century", "Hungary"],
  ["Mafé", "SN", 14.7, -17.5, 1800, "century", "Senegal"],
  ["Mantı", "TR", 39.9, 32.9, 1400, "century", "Turkey"],
  ["Miso Soup", "JP", 35.7, 139.7, 700, "century", "Japan"],
  ["Mole Poblano", "MX", 19.0, -98.2, 1600, "century", "Mexico"],
  ["Moin Moin", "NG", 6.5, 3.4, 1800, "century", "Nigeria"],
  ["Nyama Choma", "KE", -1.3, 36.8, 1800, "century", "Kenya"],
  ["Okonomiyaki", "JP", 34.7, 135.5, 1900, "century", "Japan"],
  ["Pão de Queijo", "BR", -19.9, -43.9, 1700, "century", "Minas Gerais, Brazil"],
  ["Pastel de Nata", "PT", 38.7, -9.1, 1800, "century", "Lisbon, Portugal"],
  ["Piri Piri", "MZ", -25.9, 32.6, 1500, "century", "Mozambique"],
  ["Plov", "UZ", 41.3, 69.2, -1000, "century", "Central Asia"],
  ["Pozole", "MX", 19.4, -99.1, 1300, "century", "Mexico"],
  ["Pupusa", "SV", 13.7, -89.2, 500, "century", "El Salvador"],
  ["Sancocho", "CO", 6.2, -75.6, 1500, "century", "Colombia"],
  ["Sauerbraten", "DE", 50.1, 8.7, 1300, "century", "Germany"],
  ["Serabi", "ID", -6.2, 106.8, 1500, "century", "Indonesia"],
  ["Shakshuka", "TN", 36.8, 10.2, 1500, "century", "North Africa"],
  ["Sopaipilla", "CL", -33.4, -70.7, 1700, "century", "Chile"],
  ["Tamales", "MX", 19.4, -99.1, -500, "century", "Mesoamerica"],
  ["Tteokbokki", "KR", 37.6, 127.0, 1950, "year", "Korea"],
  ["Vatapá", "BR", -12.9, -38.5, 1700, "century", "Bahia, Brazil"],
  ["Xôi", "VN", 21.0, 105.8, -500, "century", "Vietnam"],
  ["Yakisoba", "JP", 35.7, 139.7, 1900, "century", "Japan"],
  ["Za'atar Manakish", "LB", 33.9, 35.5, 1000, "century", "Levant"],
];

const landmarks = [
  ["Atacama Desert", "CL", -23.9, -69.3, -100000, "mya", "Chile"],
  ["Banff National Park", "CA", 51.2, -115.6, 1885, "year", "Canada"],
  ["Blyde River Canyon", "ZA", -24.6, 30.8, -200000000, "mya", "South Africa"],
  ["Blue Mountains", "AU", -33.7, 150.3, -500000000, "mya", "Australia"],
  ["Bora Bora", "PF", -16.5, -151.7, -3000000, "mya", "French Polynesia"],
  ["Bryce Canyon", "US", 37.6, -112.2, -60000000, "mya", "United States"],
  ["Cinque Terre", "IT", 44.1, 9.7, 1100, "century", "Italy"],
  ["Danube Delta", "RO", 45.2, 29.0, -10000, "mya", "Romania"],
  ["El Nido", "PH", 11.2, 119.4, -250000000, "mya", "Philippines"],
  ["Fiordland National Park", "NZ", -45.4, 167.7, -500000000, "mya", "New Zealand"],
  ["Gobi Desert", "MN", 43.0, 103.0, -400000000, "mya", "Mongolia"],
  ["Great Ocean Road", "AU", -38.7, 143.1, 1932, "year", "Australia"],
  ["Jeju Island", "KR", 33.4, 126.5, -2000000, "mya", "South Korea"],
  ["Jungfrau Region", "CH", 46.6, 8.0, -20000000, "mya", "Switzerland"],
  ["K2", "PK", 35.9, 76.5, -50000000, "mya", "Pakistan"],
  ["Komodo National Park", "ID", -8.6, 119.5, -1500000, "mya", "Indonesia"],
  ["Lofoten Islands", "NO", 68.2, 13.7, -300000000, "mya", "Norway"],
  ["Maasai Mara", "KE", -1.5, 35.1, -5000000, "mya", "Kenya"],
  ["Milford Sound", "NZ", -44.7, 167.9, -10000000, "mya", "New Zealand"],
  ["Ngorongoro Crater", "TZ", -3.2, 35.5, -2500000, "mya", "Tanzania"],
  ["Okavango Delta", "BW", -19.3, 22.9, -2000000, "mya", "Botswana"],
  ["Palawan", "PH", 9.8, 118.7, -50000000, "mya", "Philippines"],
  ["Raja Ampat", "ID", -0.2, 130.5, -100000000, "mya", "Indonesia"],
  ["Red Sea Coast", "EG", 27.3, 33.8, -5000000, "mya", "Egypt"],
  ["Sapa Valley", "VN", 22.3, 103.8, 1900, "century", "Vietnam"],
  ["Serengeti Plains", "TZ", -2.3, 34.8, -4000000, "mya", "Tanzania"],
  ["Torres del Paine", "CL", -51.0, -73.0, -12000000, "mya", "Chile"],
  ["Wadi Rum", "JO", 29.6, 35.4, -300000000, "mya", "Jordan"],
  ["Zhangye Danxia", "CN", 38.9, 100.1, -100000000, "mya", "China"],
  ["Aoraki Mount Cook", "NZ", -43.7, 170.1, -25000000, "mya", "New Zealand"],
  ["Arashiyama Bamboo Grove", "JP", 35.0, 135.7, 700, "century", "Japan"],
  ["Bazaruto Archipelago", "MZ", -21.7, 35.5, -100000000, "mya", "Mozambique"],
  ["Cenotes of Yucatán", "MX", 20.7, -88.6, -65000000, "mya", "Mexico"],
  ["Dallol Depression", "ET", 14.2, 40.3, -34000000, "mya", "Ethiopia"],
  ["Enchanted River", "PH", 8.8, 125.7, -1000000, "mya", "Philippines"],
  ["Fjaðrárgljúfur Canyon", "IS", 63.8, -18.2, -9000, "mya", "Iceland"],
  ["Giant's Causeway Coast", "GB", 55.2, -6.5, -60000000, "mya", "Northern Ireland"],
  ["Huangshan Mountains", "CN", 30.1, 118.2, -140000000, "mya", "China"],
  ["Isle of Skye", "GB", 57.3, -6.2, -600000000, "mya", "Scotland"],
  ["Kakadu Wetlands", "AU", -12.7, 132.5, -1400000000, "mya", "Australia"],
  ["Lake Bled", "SI", 46.4, 14.1, -12000, "mya", "Slovenia"],
  ["Lençóis Maranhenses", "BR", -2.5, -43.1, -1000000, "mya", "Brazil"],
  ["Meteora Cliffs", "GR", 39.7, 21.6, -300000000, "mya", "Greece"],
  ["Námafjall Geothermal Area", "IS", 65.6, -16.8, -10000, "mya", "Iceland"],
  ["Orkney Islands", "GB", 59.0, -3.0, -400000000, "mya", "Scotland"],
  ["Pamukkale Terraces", "TR", 37.9, 29.1, -14000, "mya", "Turkey"],
  ["Salar de Atacama", "CL", -23.5, -68.2, -1000000, "mya", "Chile"],
  ["Tsingy de Bemaraha", "MG", -18.7, 44.7, -160000000, "mya", "Madagascar"],
  ["Valley of Flowers", "IN", 30.7, 79.6, -50000000, "mya", "India"],
  ["Yosemite Valley", "US", 37.7, -119.5, -10000000, "mya", "United States"],
];

const monuments = [
  ["Alcázar of Seville", "ES", 37.4, -5.99, 913, "year", "Spain"],
  ["Baalbek Temples", "LB", 34.0, 36.2, -900, "century", "Lebanon"],
  ["Bam Citadel", "IR", 29.1, 58.4, -500, "century", "Iran"],
  ["Banteay Srei", "KH", 13.6, 103.9, 967, "year", "Cambodia"],
  ["Belém Tower", "PT", 38.7, -9.2, 1514, "year", "Portugal"],
  ["Mahabodhi Temple", "IN", 24.7, 84.99, -250, "century", "India"],
  ["Casa Batlló", "ES", 41.4, 2.2, 1906, "year", "Spain"],
  ["Chogha Zanbil", "IR", 32.0, 48.5, -1250, "century", "Iran"],
  ["Cité de Carcassonne", "FR", 43.2, 2.4, 1000, "century", "France"],
  ["Coricancha", "PE", -13.5, -71.97, 1450, "year", "Peru"],
  ["Derawar Fort", "PK", 28.8, 71.3, 900, "century", "Pakistan"],
  ["Djenne Great Mosque", "ML", 13.9, -4.6, 1907, "year", "Mali"],
  ["Erechtheion", "GR", 37.97, 23.73, -421, "year", "Greece"],
  ["Fort Jesus", "KE", -4.1, 39.7, 1593, "year", "Kenya"],
  ["Himeji Castle", "JP", 34.8, 134.7, 1609, "year", "Japan"],
  ["Hohenzollern Castle", "DE", 48.3, 8.97, 1867, "year", "Germany"],
  ["Humayun's Tomb", "IN", 28.59, 77.25, 1572, "year", "India"],
  ["Jantar Mantar Jaipur", "IN", 26.9, 75.8, 1734, "year", "India"],
  ["Karnak Temple", "EG", 25.7, 32.7, -2000, "century", "Egypt"],
  ["Kumbhalgarh Fort", "IN", 25.1, 73.6, 1458, "year", "India"],
  ["Library of Celsus", "TR", 37.9, 27.3, 117, "year", "Turkey"],
  ["Mausoleum of the First Qin Emperor", "CN", 34.4, 109.3, -210, "year", "China"],
  ["Medinet Habu", "EG", 25.7, 32.6, -1150, "century", "Egypt"],
  ["Montreal Notre-Dame Basilica", "CA", 45.5, -73.6, 1829, "year", "Canada"],
  ["Narikala Fortress", "GE", 41.7, 44.8, 400, "century", "Georgia"],
  ["Obelisk of Axum", "ET", 14.1, 38.7, 400, "century", "Ethiopia"],
  ["Palace of the Grand Masters", "GR", 36.4, 28.2, 1309, "year", "Greece"],
  ["Qutb Minar", "IN", 28.5, 77.2, 1193, "year", "India"],
  ["Rila Monastery", "BG", 42.1, 23.3, 927, "year", "Bulgaria"],
  ["Royal Palace of Madrid", "ES", 40.4, -3.7, 1738, "year", "Spain"],
  ["Sakya Monastery", "CN", 28.9, 88.0, 1268, "year", "Tibet"],
  ["San Felipe de Barajas Castle", "CO", 10.4, -75.5, 1657, "year", "Colombia"],
  ["Sanchi Stupa", "IN", 23.5, 77.7, -250, "century", "India"],
  ["Stari Most", "BA", 43.3, 17.8, 1566, "year", "Bosnia and Herzegovina"],
  ["Temple of Hatshepsut", "EG", 25.7, 32.6, -1450, "century", "Egypt"],
  ["Temple of Heaven", "CN", 39.9, 116.4, 1420, "year", "China"],
  ["Thean Hou Temple", "MY", 3.1, 101.7, 1989, "year", "Malaysia"],
  ["Tomb of Cyrus", "IR", 30.2, 53.2, -530, "year", "Iran"],
  ["Topkapı Palace", "TR", 41.0, 28.98, 1478, "year", "Turkey"],
  ["Uspenski Cathedral Helsinki", "FI", 60.2, 24.96, 1868, "year", "Finland"],
  ["Vijaya Vittala Temple", "IN", 15.3, 76.5, 1513, "year", "India"],
  ["Wat Pho", "TH", 13.75, 100.49, 1782, "year", "Thailand"],
  ["Wawel Castle", "PL", 50.05, 19.94, 1300, "century", "Poland"],
  ["White Temple of Chiang Rai", "TH", 19.8, 99.8, 1997, "year", "Thailand"],
  ["Xunantunich", "BZ", 17.1, -89.1, 700, "century", "Belize"],
  ["Yazd Atash Behram", "IR", 31.9, 54.4, 470, "year", "Iran"],
  ["Zvartnots Cathedral", "AM", 40.2, 44.3, 652, "year", "Armenia"],
  ["Bibi-Heybat Mosque", "AZ", 40.3, 49.8, 1997, "year", "Azerbaijan"],
  ["Galle Dutch Fort", "LK", 6.0, 80.2, 1588, "year", "Sri Lanka"],
  ["Kizhi Pogost", "RU", 62.1, 35.2, 1714, "year", "Russia"],
];

function slug(value) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function makeItem(category, row) {
  const [title, countryCode, latitude, longitude, startYear, timePrecision, place] = row;
  const isFood = category === "food";
  const isFossil = category === "animal";
  const kind = isFood ? "traditional dish" : isFossil ? "fossil or ancient life form" : category === "monument" ? "historic monument" : "natural or cultural sight";
  const description = `${title} is a ${kind} connected with ${place}. Its recorded location gives the topic a clear geographic context.`;
  const history = isFossil
    ? `The record of ${title} helps scientists understand life and environments from ${place}, long before the modern world.`
    : isFood
      ? `${title} carries cooking traditions from ${place}. Families and communities have adapted its ingredients and methods across generations.`
      : `${title} reflects the landscape and history of ${place}. Its story has been shaped by local communities, travelers, and changing eras.`;
  const item = {
    category,
    latitude,
    longitude,
    country_code: countryCode,
    icon_slug: category,
    is_published: true,
    location_desc: `${title} is associated with ${place}.`,
    fun_facts: [
      `${title} is associated with ${place}.`,
      `It is described as a ${kind}.`,
      `Its recorded location gives the topic a geographic context.`,
    ],
    media: [{ media_type: "image", label: title, filename: `placeholder-${category}.jpg` }],
    translations: [
      { lang: "en", title, description, history },
      { lang: "vi", title, description: `${title} là ${kind} gắn liền với ${place}. Hãy khám phá vị trí của nó trong câu chuyện dài của con người, thiên nhiên và thế giới luôn thay đổi.`, history: `${title} lưu giữ câu chuyện về địa lý và lịch sử của ${place}, được định hình qua nhiều thế hệ.` },
    ],
    start_year: startYear,
    time_precision: timePrecision,
    quiz_questions: [],
  };
  if (isFood) {
    item.recipe = `With a grown-up's help, explore the ingredients and traditional steps used to prepare ${title}. Compare its flavors with foods from another place.`;
  }
  return item;
}

const generated = [
  ...fossils.map((row) => makeItem("animal", row)),
  ...foods.map((row) => makeItem("food", row)),
  ...landmarks.map((row) => makeItem("landmark", row)),
  ...monuments.map((row) => makeItem("monument", row)),
];

if (generated.length !== 200) throw new Error(`Expected 200 generated items, got ${generated.length}`);

const outputPath = resolve(dirname(new URL(import.meta.url).pathname), "../data/generated-catalog.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(generated, null, 2)}\n`);
console.log(`Generated ${generated.length} catalog items at ${outputPath}.`);
