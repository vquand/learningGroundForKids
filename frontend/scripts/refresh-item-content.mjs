import { readFile, writeFile } from "node:fs/promises";
import https from "node:https";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildReviewedItem,
  classifyCatalogCategory,
  countWords,
  isInsufficientContent,
  isLikelyVietnamese,
  isPlaceholderText,
  isQualityDescription,
  normalizeCatalogItem,
  truncateWords,
} from "./catalog-content-review-lib.mjs";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(frontendDir, "data");
const pageApi = "https://en.wikipedia.org/w/api.php";
const vietnamesePageApi = "https://vi.wikipedia.org/w/api.php";
const wikidataApi = "https://www.wikidata.org/w/api.php";
const userAgent = process.env.CATALOG_REFRESH_USER_AGENT
  || "PersonalLearningGround/1.0 (educational catalog content refresh)";
const delayMs = Math.max(50, Number(process.env.CATALOG_REFRESH_DELAY_MS || 100));
const requestTimeoutMs = Math.max(5_000, Number(process.env.CATALOG_REFRESH_TIMEOUT_MS || 30_000));
const fallbackLimit = Math.max(0, Number(process.env.CATALOG_REFRESH_FALLBACK_LIMIT || 5_000));
const fallbackConcurrency = Math.max(1, Number(process.env.CATALOG_REFRESH_FALLBACK_CONCURRENCY || 2));
const fallbackDelayMs = Math.max(250, Number(process.env.CATALOG_REFRESH_FALLBACK_DELAY_MS || 500));
const pageConcurrency = Math.max(1, Number(process.env.CATALOG_REFRESH_PAGE_CONCURRENCY || 4));
const translationApi = process.env.CATALOG_TRANSLATION_API || "https://translate.googleapis.com/translate_a/single";
const translationConcurrency = Math.max(1, Number(process.env.CATALOG_TRANSLATION_CONCURRENCY || 8));
const translationDelayMs = Math.max(250, Number(process.env.CATALOG_TRANSLATION_DELAY_MS || 250));
const skipFullExtract = process.env.CATALOG_REFRESH_SKIP_FULL_EXTRACT === "1";
const catalogPaths = ["legacy-catalog.json", "generated-catalog.json", "expanded-catalog.json"];
const wikipediaTitleAliases = new Map([
  ["Amok", "Fish amok"],
  ["Dosa", "Dosa (food)"],
  ["Moin Moin", "Moin moin"],
  ["Raja Ampat", "Raja Ampat Islands"],
  ["Lofoten Islands", "Lofoten"],
  ["Ngorongoro Crater", "Ngorongoro Conservation Area"],
  ["Serengeti Plains", "Serengeti"],
  ["Zhangye Danxia", "Zhangye National Geopark"],
  ["Huangshan Mountains", "Huangshan"],
  ["Lençóis Maranhenses", "Lençóis Maranhenses National Park"],
  ["Orkney Islands", "Orkney"],
  ["Tsingy de Bemaraha", "Tsingy de Bemaraha National Park"],
  ["Valley of Flowers", "Valley of Flowers National Park"],
  ["Bam Citadel", "Arg-e Bam"],
  ["Kumbhalgarh Fort", "Kumbhalgarh"],
  ["Djenne Great Mosque", "Great Mosque of Djenné"],
  ["Jantar Mantar Jaipur", "Jantar Mantar, Jaipur"],
  ["Montreal Notre-Dame Basilica", "Notre-Dame Basilica"],
  ["Narikala Fortress", "Narikala"],
  ["Palace of the Grand Masters", "Palace of the Grand Master of the Knights of Rhodes"],
  ["San Felipe de Barajas Castle", "Castillo San Felipe de Barajas"],
  ["Temple of Hatshepsut", "Mortuary Temple of Hatshepsut"],
  ["Uspenski Cathedral Helsinki", "Uspenski Cathedral (Helsinki)"],
  ["Vijaya Vittala Temple", "Vittala Temple"],
  ["White Temple of Chiang Rai", "Wat Rong Khun"],
  ["Galle Dutch Fort", "Galle Fort"],
  ["Dodo remains", "Dodo"],
  ["Quagga remains", "Quagga"],
  ["Red Sea Coast", "Red Sea"],
  ["Sapa Valley", "Sa Pa, Lào Cai"],
  ["Aoraki Mount Cook", "Aoraki / Mount Cook"],
  ["Arashiyama Bamboo Grove", "Arashiyama"],
  ["Cenotes of Yucatán", "Cenote"],
  ["Dallol Depression", "Dallol (hydrothermal system)"],
  ["Fjaðrárgljúfur Canyon", "Fjaðrárgljúfur"],
  ["Giant's Causeway Coast", "Giant's Causeway"],
  ["Kakadu Wetlands", "Kakadu National Park"],
  ["Meteora Cliffs", "Meteora"],
  ["Námafjall Geothermal Area", "Hverir"],
  ["Pamukkale Terraces", "Pamukkale"],
  ["Baalbek Temples", "Baalbek"],
  ["Uspenski Cathedral Helsinki", "Uspenski Cathedral"],
  ["Vijaya Vittala Temple", "Hampi"],
]);
const ingredientTerms = [
  "rice", "rice flour", "rice noodles", "wheat", "corn", "cornmeal", "potato", "bread", "noodles",
  "beans", "lentils", "chickpeas", "beef", "pork", "chicken", "lamb", "fish", "shrimp", "egg",
  "milk", "cheese", "yogurt", "butter", "coconut", "peanut", "sesame", "soy", "tofu", "tomato",
  "onion", "garlic", "ginger", "chili", "pepper", "herbs", "lime", "lemon", "sugar", "honey",
];
const knownFoodIngredients = {
  "aloo gobi": ["potato", "cauliflower", "onion", "tomato", "spices"],
  "jerk chicken": ["chicken", "allspice", "scotch bonnet pepper", "thyme", "ginger"],
  koshari: ["rice", "lentils", "macaroni", "chickpeas", "tomato sauce", "fried onion"],
  mafé: ["peanut", "tomato", "onion", "chicken or beef", "chili"],
  mantı: ["wheat flour", "ground meat", "onion", "yogurt", "garlic"],
  "mole poblano": ["chili peppers", "tomato", "nuts", "spices", "chocolate"],
  "moin moin": ["black-eyed beans", "onion", "red pepper", "spices", "oil"],
  "mao xue wang": ["duck blood", "beef tripe", "mung bean sprouts", "chili", "Sichuan pepper"],
  "terrine (food)": ["forcemeat", "pork or game meat", "aspic", "mushrooms", "vegetables"],
  "nyama choma": ["goat or beef", "salt", "spices"],
  plov: ["rice", "carrot", "onion", "meat", "oil"],
  shakashuka: ["tomato", "pepper", "onion", "egg"],
  shakshuka: ["tomato", "pepper", "onion", "egg"],
  tamales: ["corn dough", "meat or vegetables", "chili", "corn husk"],
  "mì quảng": ["rice noodles", "shrimp", "pork", "fresh herbs", "turmeric", "peanuts", "sesame rice crackers", "lime", "chili"],
};
const reviewedFoodSummaryOverrides = new Map([
  ["Moin Moin", "Moin-moin is a Nigerian steamed bean pudding made from peeled black-eyed beans, onions, fresh peppers, spices, and oil. It may also include fish, eggs, chicken, or crayfish, and is often wrapped in leaves before steaming."],
]);
const reviewedSummaryOverrides = new Map([
  ["Terrine (food)", {
    en: "A terrine is a French dish made from forcemeat or aspic. It is cooked in a covered mold called a terrine. Traditional versions often use pork or game meat. Other versions can use fish, vegetables, mushrooms, or fruit. The mixture is cooked gently in a bain-marie. This water bath helps the terrine cook evenly. Terrines are commonly served cold or at room temperature. Their texture is firm, sliceable, and rich. The word also names the pottery dish used for cooking. Terrine belongs to the French charcuterie tradition.",
    vi: "Terrine là món ăn Pháp làm từ thịt xay trộn hoặc aspic. Món được nấu trong khuôn có nắp cũng gọi là terrine. Phiên bản truyền thống thường dùng thịt heo hoặc thịt thú săn. Một số phiên bản khác dùng cá, rau củ, nấm hoặc trái cây. Hỗn hợp thường được nấu nhẹ trong nồi cách thủy. Cách này giúp terrine chín đều. Món thường được ăn lạnh hoặc ở nhiệt độ phòng. Kết cấu của terrine chắc, có thể cắt lát và khá béo. Từ terrine cũng chỉ loại khuôn bằng đất nung dùng để nấu món. Terrine thuộc truyền thống thịt nguội charcuterie của Pháp.",
    historyEn: "Terrines grew from French pâté and charcuterie traditions, where seasoned forcemeat was cooked and preserved in a covered dish. The name later came to describe both the preparation and the mold used to make it.",
    historyVi: "Terrine phát triển từ truyền thống pâté và charcuterie của Pháp, trong đó thịt xay tẩm gia vị được nấu và bảo quản trong một chiếc khuôn có nắp. Về sau, tên gọi này dùng cho cả món ăn và khuôn chế biến món.",
    funFactsEn: [
      "A bain-marie is a water bath used for gentle, even cooking.",
      "Terrines can be made with meat, fish, vegetables, mushrooms, or fruit.",
      "The same word names the dish and its traditional cooking mold.",
    ],
  }],
  ["Long Sơn Pagoda", {
    en: "Long Sơn Temple, also called Long Sơn Pagoda, is a Buddhist temple in Nha Trang, Vietnam. It stands at the foot of Trại Thủy Mountain near the city center. The temple was founded on another hill in 1886. A cyclone destroyed the original site in 1900. The temple was then moved to its present location. Its grounds include a garden, a ceremonial hall, and decorative dragon mosaics. A large white Buddha statue stands on the hill above the temple. The statue is reached by 152 stone steps. It is a well-known landmark in Nha Trang. The temple combines Buddhist worship, local history, and views across the city.",
    vi: "Chùa Long Sơn, còn gọi là Long Sơn Pagoda, là một ngôi chùa Phật giáo ở Nha Trang, Việt Nam. Chùa nằm dưới chân núi Trại Thủy, gần trung tâm thành phố. Chùa được dựng trên một ngọn đồi khác vào năm 1886. Một trận bão lớn đã phá hủy địa điểm cũ vào năm 1900. Sau đó chùa được chuyển đến vị trí hiện nay. Khuôn viên có vườn, chính điện và các mảng khảm hình rồng. Trên ngọn đồi phía sau chùa có một tượng Phật trắng lớn. Du khách đi qua 152 bậc đá để đến tượng. Đây là một địa danh nổi tiếng của Nha Trang. Ngôi chùa kết hợp đời sống Phật giáo, lịch sử địa phương và tầm nhìn ra thành phố.",
    historyEn: "Long Sơn Temple was founded in 1886 and moved after a cyclone destroyed its original hilltop site in 1900. The temple later became an important Buddhist center in Khánh Hòa Province and was repeatedly restored.",
    historyVi: "Chùa Long Sơn được dựng vào năm 1886 và được chuyển đi sau khi một trận bão phá hủy địa điểm trên đồi vào năm 1900. Về sau, chùa trở thành một trung tâm Phật giáo quan trọng của tỉnh Khánh Hòa và nhiều lần được trùng tu.",
    funFactsEn: [
      "The temple was previously known as Đăng Long Tự.",
      "The white Buddha statue is reached by 152 stone steps.",
      "Dragon mosaics decorate the entrance and roofs.",
    ],
  }],
  ["Thiên Phúc Pagoda", {
    en: "Thiên Phúc Pagoda is an old Buddhist pagoda in Quốc Oai, Hanoi, Vietnam. It is associated with the historic temple landscape of the district. The Vietnamese name Thiên Phúc Tự can be understood as Temple of Heavenly Blessing. The pagoda reflects the long Buddhist tradition of the Red River region. Its buildings provide a place for worship, community gatherings, and seasonal ceremonies. Local temple architecture connects the site with Vietnamese religious art. The surrounding district is known for historic villages and cultural landmarks. Visitors can study the pagoda as part of the area's living heritage. Its quiet setting contrasts with the growing urban region around Hanoi. Thiên Phúc Pagoda remains a local cultural and religious landmark.",
    vi: "Chùa Thiên Phúc là một ngôi chùa Phật giáo cổ ở Quốc Oai, Hà Nội, Việt Nam. Chùa gắn với các di tích và chùa cổ của địa phương. Tên Thiên Phúc Tự có thể hiểu là ngôi chùa mang phúc lành của trời. Chùa phản ánh truyền thống Phật giáo lâu đời của vùng đồng bằng sông Hồng. Đây là nơi thờ tự, sinh hoạt cộng đồng và tổ chức nghi lễ. Kiến trúc chùa gắn địa điểm này với nghệ thuật tôn giáo Việt Nam. Khu vực xung quanh có nhiều làng cổ và địa danh văn hóa. Người học có thể tìm hiểu chùa như một phần của di sản địa phương. Không gian chùa yên tĩnh giữa vùng đô thị đang phát triển quanh Hà Nội. Thiên Phúc Pagoda vẫn là một địa điểm văn hóa và tôn giáo của Quốc Oai.",
    historyEn: "Thiên Phúc Pagoda belongs to the Buddhist heritage of Quốc Oai, an area southwest of Hanoi with a long history of village temples. Its name and continued religious use connect the site with local traditions of worship and community life.",
    historyVi: "Chùa Thiên Phúc thuộc di sản Phật giáo của Quốc Oai, khu vực phía tây nam Hà Nội có truyền thống lâu đời về các ngôi chùa làng. Tên gọi và hoạt động thờ tự hiện nay gắn địa điểm này với truyền thống tín ngưỡng và đời sống cộng đồng địa phương.",
    funFactsEn: [
      "Thiên Phúc Tự is the temple's Vietnamese Sino-derived name.",
      "The pagoda is associated with Quốc Oai southwest of Hanoi.",
      "Its heritage is connected with village temples of the Red River region.",
    ],
  }],
  ["Burganlage", {
    en: "Burganlage is a protected cultural heritage monument in Bad Neustadt an der Saale, Bavaria, Germany. The catalog identifies it by monument number D-6-73-114-124 (0). Its name refers to a fortified complex or castle site. The monument belongs to the historic landscape of the town. Fortified buildings helped medieval communities control entrances and protect important settlements. Surviving walls and structures preserve evidence of regional defensive architecture. The site links local history with the wider story of castles and town fortifications in Bavaria. It can be studied as a cultural monument rather than only as a military structure. Burganlage adds a local example of German built heritage to the learning catalog.",
    vi: "Burganlage là một di tích văn hóa được bảo vệ ở Bad Neustadt an der Saale, bang Bayern, Đức. Danh mục xác định di tích bằng số hiệu D-6-73-114-124 (0). Tên Burganlage chỉ một quần thể công sự hoặc khu thành cổ. Di tích thuộc không gian lịch sử của thị trấn. Công trình phòng thủ từng giúp cộng đồng thời trung cổ bảo vệ khu dân cư. Những bức tường còn lại lưu giữ dấu tích của kiến trúc phòng thủ vùng. Địa điểm này kết nối lịch sử địa phương với lâu đài và thành lũy ở Bayern. Người học có thể xem đây là di tích kiến trúc và quân sự. Burganlage bổ sung một ví dụ về di sản xây dựng của Đức.",
    historyEn: "Burganlage is recorded as part of the historic and cultural heritage of Bad Neustadt an der Saale. Its monument number preserves a formal link between the surviving site and Bavaria's system of protected heritage places.",
    historyVi: "Burganlage được ghi nhận là một phần của di sản lịch sử và văn hóa Bad Neustadt an der Saale. Số hiệu di tích tạo mối liên hệ chính thức giữa địa điểm còn lại và hệ thống di sản được bảo vệ của bang Bayern.",
    funFactsEn: [
      "The monument number is D-6-73-114-124 (0).",
      "Burganlage is a German term for a fortified complex.",
      "The site is located in Bavaria, Germany.",
    ],
  }],
  ["Cenotes of Yucatán", {
    en: "Cenotes are natural pits or sinkholes formed when limestone collapses and exposes groundwater. The term comes from the lowland Yucatec Maya word ts'ono'ot, meaning a place with accessible groundwater. The Yucatán Peninsula of Mexico contains thousands of cenotes. Ancient Maya communities used them as water sources. Some cenotes also had religious importance and received offerings. Many are open pools, while others are sheltered entrances to flooded cave systems. Their clear water comes mainly from rain filtering through limestone. Cenotes are important geological features, cultural sites, and places for swimming or cave diving. Their underground waterways connect parts of the Yucatán aquifer. Pollution and construction can threaten these fragile environments.",
    vi: "Cenote là hố tự nhiên hoặc hố sụt khi đá vôi sụp xuống và làm lộ nước ngầm. Tên gọi bắt nguồn từ tiếng Maya Yucatec, chỉ nơi có nguồn nước ngầm. Bán đảo Yucatán của Mexico có hàng nghìn cenote. Người Maya cổ đại dùng chúng làm nguồn nước. Một số cenote còn có ý nghĩa tôn giáo và là nơi dâng lễ vật. Nhiều cenote là hồ mở, số khác dẫn vào các hệ thống hang ngập nước. Nước thường đến từ mưa lọc qua đá vôi. Cenote là đặc điểm địa chất, địa điểm văn hóa và nơi bơi hoặc lặn hang. Các dòng nước của chúng kết nối những phần của tầng chứa nước Yucatán. Ô nhiễm và xây dựng có thể đe dọa môi trường này.",
    historyEn: "The word cenote entered wider use from the Yucatán Peninsula, where ancient Maya communities depended on these openings to groundwater. Some cenotes became ceremonial places associated with offerings to Maya deities.",
    historyVi: "Từ cenote được dùng rộng rãi từ bán đảo Yucatán, nơi các cộng đồng Maya cổ đại phụ thuộc vào những cửa mở dẫn tới nước ngầm. Một số cenote trở thành địa điểm nghi lễ gắn với việc dâng lễ vật cho các vị thần Maya.",
    funFactsEn: [
      "There are thousands of cenotes across the Yucatán Peninsula.",
      "Some cenotes open into extensive flooded cave systems.",
      "The ancient Maya used cenotes for water and religious ceremonies.",
    ],
  }],
  ["Mao xue wang", {
    en: "Mao xue wang is a Chongqing dish from China. Its Chinese name is 毛血旺. The name is often translated as raw blood soup. The dish combines blood curd and tripe. Mung bean sprouts are commonly added. The ingredients are cooked in a spicy, oily mala broth. Chilies and Sichuan pepper give the broth its strong flavor. Unlike Chongqing hot pot, mao xue wang is cooked before it is served. It arrives in a communal bowl instead of simmering at the table. Its cooking style resembles shuizhu dishes.",
    vi: "毛血旺 là món ăn Trùng Khánh của Trung Quốc. Tên món được viết bằng chữ Hán là 毛血旺. Tên này thường được dịch là canh huyết tươi. Món ăn kết hợp tiết đông và lòng bò. Giá đỗ xanh thường được thêm vào món. Các nguyên liệu được nấu trong nước dùng mala cay và nhiều dầu. Nước dùng có vị đậm của ớt và tiêu Tứ Xuyên. Khác với lẩu Trùng Khánh, món này được nấu chín trước khi phục vụ. Món thường được dọn trong một bát chung thay vì đun tại bàn. Cách chế biến của nó có nét tương đồng với các món thủy chử.",
    historyEn: "Mao xue wang developed as a regional dish of Chongqing cuisine and is associated with the food traditions of southwestern China. Its name and spicy broth reflect local ingredients and Sichuan-style seasoning.",
    historyVi: "毛血旺 phát triển như một món ăn vùng miền trong ẩm thực Trùng Khánh và gắn với truyền thống ẩm thực Tây Nam Trung Quốc. Tên gọi cùng nước dùng cay thể hiện nguyên liệu địa phương và cách nêm kiểu Tứ Xuyên.",
    funFactsEn: [
      "Its Chinese name is 毛血旺.",
      "It is served fully cooked rather than simmered at the table.",
      "Mala seasoning combines chili heat with the numbing aroma of Sichuan pepper.",
    ],
  }],
  ["Mì Quảng", {
    en: "Mì Quảng is a Vietnamese noodle dish from Quảng Nam Province in central Vietnam. Its name means Quảng noodles. The dish is popular in the Da Nang and Quảng Nam area and is now eaten across Vietnam. Wide rice noodles are served with a small amount of warm, strongly flavored broth. Common toppings include shrimp, pork, chicken, fish, or other meats. Turmeric often gives the broth and noodles a golden color. Fresh herbs such as basil, cilantro, scallions, Vietnamese coriander, and banana flower add flavor and color. Peanuts and toasted sesame rice crackers are traditional toppings that make the dish easy to recognize. People may add lime and chili for extra brightness and heat. Mì Quảng is served at everyday meals and celebrations, including family gatherings and Tết.",
    vi: "Mì Quảng là món mì Việt Nam có nguồn gốc từ Quảng Nam, miền Trung. Tên món ăn có nghĩa là mì Quảng. Món này nổi tiếng ở Quảng Nam và Đà Nẵng, rồi phổ biến trên cả nước. Sợi mì gạo bản rộng thường ăn cùng một ít nước dùng đậm đà và còn ấm. Tô mì có thể dùng tôm, thịt heo, thịt gà, cá hoặc loại thịt khác. Nghệ tạo màu vàng và thêm hương vị cho nước dùng. Rau thơm như húng quế, rau mùi, hành lá, rau răm và hoa chuối làm món ăn tươi ngon. Đậu phộng và bánh tráng mè nướng là các món ăn kèm đặc trưng. Chanh và ớt có thể được thêm vào để tạo vị chua cay. Mì Quảng xuất hiện trong bữa ăn hằng ngày, các buổi sum họp và dịp Tết.",
    historyEn: "Mì Quảng developed in the Quảng Nam–Da Nang region and became a recognizable dish of central Vietnamese cuisine. In 2024, it was included on Vietnam’s national intangible cultural heritage list.",
    historyVi: "Mì Quảng phát triển ở vùng Quảng Nam–Đà Nẵng và trở thành món ăn tiêu biểu của ẩm thực miền Trung Việt Nam. Năm 2024, món ăn này được đưa vào danh sách di sản văn hóa phi vật thể quốc gia của Việt Nam.",
    funFactsEn: [
      "Its name means Quảng noodles.",
      "It is traditionally served with only a small amount of broth.",
      "Peanuts and toasted sesame rice crackers are distinctive toppings.",
    ],
  }],
  ["Lullaby (Wiegenlied) — Johannes Brahms", {
    en: "Wiegenlied, Op. 49, No. 4 is a song for voice and piano composed by Johannes Brahms and first published in 1868. Its gentle melody is widely known as Brahms's Lullaby.",
    vi: "Wiegenlied, Op. 49, số 4 là ca khúc cho giọng hát và piano do Johannes Brahms sáng tác, được xuất bản lần đầu vào năm 1868. Giai điệu dịu dàng này thường được gọi là Brahms's Lullaby.",
    historyEn: "Brahms dedicated the lullaby to his friend Bertha Faber after the birth of her second son. He based part of the melody on a song she had sung to him when they were young.",
    historyVi: "Brahms dành tặng ca khúc cho người bạn Bertha Faber sau khi con trai thứ hai của bà chào đời. Một phần giai điệu dựa trên bài hát bà từng hát cho ông khi còn trẻ.",
    funFactsEn: [
      "The piece is catalogued as Op. 49, No. 4.",
      "It was first published in 1868.",
      "The familiar German opening is Guten Abend, gut' Nacht.",
    ],
  }],
  ["Námafjall Geothermal Area", {
    en: "Námafjall is a mountain in northern Iceland beside the Mývatn region. At its foot, Hverir is a geothermal area known for steaming fumaroles and bubbling mud pools. The colors and sulfur-rich ground show how volcanic heat reaches the surface.",
    vi: "Námafjall là một ngọn núi ở miền bắc Iceland, gần vùng hồ Mývatn. Dưới chân núi là Hverir, khu địa nhiệt nổi tiếng với các fumarole bốc hơi và vũng bùn sôi. Màu sắc cùng nền đất giàu lưu huỳnh cho thấy nhiệt núi lửa đi lên bề mặt.",
    historyEn: "Námafjall forms part of the Krafla volcanic system, and geothermal activity in the area has also supported energy research and development.",
    historyVi: "Námafjall thuộc hệ thống núi lửa Krafla, nơi hoạt động địa nhiệt cũng thúc đẩy nghiên cứu và phát triển năng lượng.",
    funFactsEn: [
      "Hverir lies at the foot of Námafjall.",
      "The area has fumaroles and boiling mud pools.",
      "Its vivid colors come from volcanic minerals and sulfur-rich ground.",
    ],
  }],
  ["Cahervagliar Ringfort", {
    en: "Cahervagliar is a ringfort and National Monument in County Cork, Ireland. The earthwork is associated with a circular fortified settlement, a common form of early medieval Irish site. Its recorded designation connects the place with Ireland's archaeological heritage.",
    vi: "Cahervagliar là một pháo đài vòng và Di tích Quốc gia ở hạt Cork, Ireland. Công trình đất này gắn với kiểu khu định cư phòng thủ hình tròn phổ biến trong các di tích Ireland thời Trung cổ đầu kỳ. Việc được công nhận là di tích liên kết địa điểm này với di sản khảo cổ Ireland.",
    historyEn: "The ringfort is listed as National Monument number 233 and is located near Cappeen West in County Cork.",
    historyVi: "Pháo đài vòng này được liệt kê là Di tích Quốc gia số 233 và nằm gần Cappeen West ở hạt Cork.",
    funFactsEn: [
      "Cahervagliar is also known as Cathair Mhac Laoighaire.",
      "The ringfort is about 73 metres in diameter.",
      "It is associated with Gaelic Ireland and a souterrain.",
    ],
  }],
]);
const reviewedSourceOverrides = new Map([
  ["Námafjall Geothermal Area", [
    { url: "https://www.northiceland.is/en/destinations/nature/geothermal-areas/namafjall", publisher: "Visit North Iceland", source_type: "reference" },
    { url: "https://www.wikidata.org/wiki/Q940545", publisher: "Wikidata", source_type: "reference" },
  ]],
  ["Cahervagliar Ringfort", [
    { url: "https://en.wikipedia.org/wiki/Cahervagliar", publisher: "English Wikipedia", source_type: "reference" },
    { url: "https://www.wikidata.org/wiki/Q1025766", publisher: "Wikidata", source_type: "reference" },
  ]],
]);

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function sentences(value) {
  return cleanText(value).split(/(?<=[.!?])\s+/u).map((sentence) => sentence.trim()).filter(Boolean);
}

function itemTitle(item) {
  return item.translations?.find((translation) => translation.lang === "en")?.title
    || item.translations?.[0]?.title
    || item.id
    || "Untitled item";
}

function wikipediaTitle(item) {
  return wikipediaTitleAliases.get(itemTitle(item)) || itemTitle(item);
}

function itemKey(item) {
  return `${item.category}|${String(item.latitude)}|${String(item.longitude)}|${itemTitle(item)}`;
}

function wikiUrl(title, language = "en") {
  return `https://${language}.wikipedia.org/wiki/${encodeURIComponent(String(title).replaceAll(" ", "_"))}`;
}

async function apiJson(endpoint, params, { attempts = 4, timeout = requestTimeoutMs, waitAfterSuccess = true } = {}) {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": userAgent },
        signal: AbortSignal.timeout(timeout),
      });
      if (response.ok) {
        const body = await response.json();
        if (body?.error) {
          throw new Error(`${body.error.code || "api_error"}: ${body.error.info || "API request failed"}`);
        }
        if (waitAfterSuccess) await sleep(delayMs);
        return body;
      }
      if (response.status !== 429 && response.status < 500) throw new Error(`${response.status} ${response.statusText}`);
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      await sleep(Math.min(30_000, Math.max(1_000 * (attempt + 1), retryAfter * 1_000)));
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await sleep(1_000 * (attempt + 1));
    }
  }
  throw lastError || new Error(`Request failed: ${url}`);
}

async function fetchPages(endpoint, titles, { fullExtract = false } = {}) {
  // The extracts module returns content for at most 20 titles per request;
  // larger batches silently return metadata without the requested extract.
  const batches = [];
  for (let offset = 0; offset < titles.length; offset += 20) batches.push(titles.slice(offset, offset + 20));
  const pageBatches = await mapConcurrent(batches, async (batch, batchIndex) => {
    let body;
    try {
      body = await apiJson(endpoint, {
        action: "query",
        titles: batch.join("|"),
        prop: "extracts|info|langlinks|pageprops|categories",
        ppprop: "wikibase_item",
        cllimit: "max",
        exintro: fullExtract ? 0 : 1,
        explaintext: 1,
        exchars: fullExtract ? 8_000 : 3_000,
        exsectionformat: "plain",
        lllang: "vi",
        llprop: "url",
        inprop: "url",
        redirects: 1,
        format: "json",
        formatversion: 2,
      });
    } catch (error) {
      console.warn(`Wikipedia batch failed at ${batchIndex * 20}/${titles.length}: ${error.message}`);
      return [];
    }
    const completed = Math.min((batchIndex + 1) * 20, titles.length);
    console.log(`Searched ${completed}/${titles.length} titles on ${endpoint.includes("vi.wikipedia") ? "Vietnamese" : "English"} Wikipedia`);
    return body.query?.pages ?? [];
  }, pageConcurrency);
  return pageBatches.flat();
}

async function searchPage(title, category) {
  const body = await apiJson(pageApi, {
    action: "query",
    list: "search",
    srsearch: `${title} ${category}`,
    srnamespace: 0,
    srlimit: 1,
    srprop: "snippet",
    format: "json",
    formatversion: 2,
  }, { attempts: 3, timeout: Math.min(requestTimeoutMs, 8_000), waitAfterSuccess: false });
  await sleep(fallbackDelayMs);
  return body.query?.search?.[0]?.title || null;
}

async function mapConcurrent(values, worker, concurrency = 8) {
  const results = new Array(values.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= values.length) return;
      results[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => run()));
  return results;
}

const translationCache = new Map();
let translationRequests = 0;

function needsBilingualReview(item) {
  const english = item.translations?.find((translation) => translation.lang === "en")?.description;
  const vietnamese = item.translations?.find((translation) => translation.lang === "vi")?.description;
  return !isQualityDescription(english)
    || !isQualityDescription(vietnamese, { language: "vi" })
    || cleanText(english).toLocaleLowerCase() === cleanText(vietnamese).toLocaleLowerCase();
}

function isGeneratedEnglishFallback(value) {
  const normalized = cleanText(value);
  return /from the listed region|geographic setting distinguish(?:es)? it from related topics|regional setting and preparation style distinguish(?:es)? it from related dishes|fossil records help scientists study ancient life/iu.test(normalized);
}

function needsVietnameseOnlyRepair(item) {
  const english = item.translations?.find((translation) => translation.lang === "en")?.description;
  const vietnamese = item.translations?.find((translation) => translation.lang === "vi")?.description;
  return isQualityDescription(english)
    && (isGeneratedVietnameseFallback(vietnamese)
      || !isQualityDescription(vietnamese, { language: "vi" })
      || cleanText(english).toLocaleLowerCase() === cleanText(vietnamese).toLocaleLowerCase());
}

function isGeneratedVietnameseFallback(value) {
  const normalized = cleanText(value);
  return /khu vực được liệt kê|bối cảnh địa lý giúp phân biệt nội dung này|nguyên liệu và cách chế biến giúp phân biệt món này/iu.test(normalized);
}

function requestTranslationJson(url) {
  return new Promise((resolvePromise, rejectPromise) => {
    const request = https.get(url, {
      headers: { Accept: "application/json", "User-Agent": userAgent },
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        if ((response.statusCode || 500) < 200 || (response.statusCode || 500) >= 300) {
          const error = new Error(`Translation service returned HTTP ${response.statusCode}`);
          error.statusCode = response.statusCode;
          rejectPromise(error);
          return;
        }
        try {
          resolvePromise(JSON.parse(body));
        } catch (error) {
          rejectPromise(error);
        }
      });
    });
    request.setTimeout(requestTimeoutMs, () => request.destroy(new Error("Translation request timed out.")));
    request.on("error", rejectPromise);
  });
}

function translatedTextFromBody(body) {
  const memoryText = cleanText(body?.responseData?.translatedText);
  if (memoryText) return memoryText;
  if (!Array.isArray(body?.[0])) return "";
  return body[0]
    .map((segment) => Array.isArray(segment) ? String(segment[0] || "") : "")
    .join("");
}

function configureTranslationUrl(url, source) {
  if (url.hostname === "translate.googleapis.com" || url.hostname === "translate.google.com") {
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "en");
    url.searchParams.set("tl", "vi");
    url.searchParams.set("dt", "t");
  } else {
    url.searchParams.set("langpair", "en|vi");
  }
  url.searchParams.set("q", source);
  return url;
}

async function translateToVietnamese(value) {
  const source = cleanText(value);
  if (!source) return "";
  if (isQualityDescription(source, { language: "vi" })) return source;
  if (translationCache.has(source)) return translationCache.get(source);
  const url = new URL(translationApi);
  configureTranslationUrl(url, source);
  let translated = "";
  for (let attempt = 0; attempt < 3 && !translated; attempt += 1) {
    await sleep(translationDelayMs + attempt * 1_000);
    try {
      const body = url.protocol === "https:" ? await requestTranslationJson(url) : await (await fetch(url)).json();
      const candidate = cleanText(translatedTextFromBody(body));
      if (candidate && candidate.toLocaleLowerCase() !== source.toLocaleLowerCase()
        && isLikelyVietnamese(candidate)) translated = candidate;
    } catch (error) {
      if (attempt === 2) console.warn(`Vietnamese translation failed: ${error.message}`);
    }
  }
  translationRequests += 1;
  if (translationRequests % 100 === 0) console.log(`Translated ${translationRequests} unique English summaries to Vietnamese`);
  translationCache.set(source, translated);
  return translated;
}

async function translateToVietnameseBatch(values) {
  const pending = [...new Set(values.map(cleanText).filter((value) => value && !translationCache.has(value)))];
  const chunks = [];
  let current = [];
  let currentLength = 0;
  for (const value of pending) {
    if (current.length && (currentLength + value.length > 4_000 || current.length >= 8)) {
      chunks.push(current);
      current = [];
      currentLength = 0;
    }
    current.push(value);
    currentLength += value.length + 18;
  }
  if (current.length) chunks.push(current);
  const delimiter = "\n|||ITEM_BREAK|||\n";
  await mapConcurrent(chunks, async (chunk) => {
    await sleep(translationDelayMs);
    const url = new URL(translationApi);
    configureTranslationUrl(url, chunk.join(delimiter));
    try {
      const body = url.protocol === "https:" ? await requestTranslationJson(url) : await (await fetch(url)).json();
      const translated = translatedTextFromBody(body);
      const parts = translated.split(/\s*\|\|\|ITEM_BREAK\|\|\|\s*/u).map(cleanText);
      if (parts.length === chunk.length) {
        chunk.forEach((source, index) => {
          const candidate = parts[index];
          translationCache.set(source, candidate && isLikelyVietnamese(candidate) ? candidate : "");
        });
      } else {
        // Mark failed chunks as attempted. This prevents source processing
        // from issuing one rate-limited request per item after a batch fails.
        chunk.forEach((source) => translationCache.set(source, ""));
      }
    } catch (error) {
      console.warn(`Vietnamese translation batch failed: ${error.message}`);
      chunk.forEach((source) => translationCache.set(source, ""));
    }
    translationRequests += chunk.length;
    if (translationRequests % 100 < chunk.length) console.log(`Translated ${translationRequests} unique English summaries to Vietnamese`);
  }, translationConcurrency);
  return translationCache;
}

function normalizedTitle(value) {
  return cleanText(value).normalize("NFKD").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
}

function searchResultMatches(originalTitle, discoveredTitle) {
  const expected = normalizedTitle(originalTitle).split(/\s+/u).filter((token) => token.length > 2 && !["the", "and", "of", "in"].includes(token));
  const discovered = normalizedTitle(discoveredTitle);
  return expected.length === 0 || expected.some((token) => discovered.includes(token));
}

function pageLookup(pages) {
  return new Map(pages.map((page) => [normalizedTitle(page.title), page]));
}

function wikidataIdFromUrl(value) {
  return String(value ?? "").match(/\/wiki\/(Q\d+)\b/u)?.[1] || null;
}

function wikidataIdForItem(item, provenanceByKey) {
  const fromItem = item.rich_fields?.sources?.map((source) => wikidataIdFromUrl(source?.url)).find(Boolean);
  return fromItem || provenanceByKey.get(itemKey(item))?.wikidata_id || null;
}

async function fetchWikidataEntities(ids) {
  const entities = new Map();
  for (let offset = 0; offset < ids.length; offset += 50) {
    const batch = ids.slice(offset, offset + 50);
    const body = await apiJson(wikidataApi, {
      action: "wbgetentities",
      ids: batch.join("|"),
      props: "labels|descriptions",
      languages: "en|vi",
      languagefallback: 1,
      format: "json",
      formatversion: 2,
    });
    for (const entity of Object.values(body.entities || {})) {
      if (entity?.id) entities.set(entity.id, entity);
    }
    console.log(`Fetched ${Math.min(offset + batch.length, ids.length)}/${ids.length} Wikidata entities`);
  }
  return entities;
}

function bestPage(title, lookup) {
  return lookup.get(normalizedTitle(title)) || null;
}

function sourceSummary(page) {
  return cleanText(page?.extract);
}

function ingredientCandidates(item, sourceText) {
  const existing = item.rich_fields?.ingredients;
  if (Array.isArray(existing) && existing.length) {
    return existing.map((ingredient) => ingredient?.name).filter((name) => typeof name === "string");
  }
  const title = itemTitle(item).toLowerCase();
  const known = knownFoodIngredients[title];
  if (known) return known;
  const text = `${sourceText} ${item.recipe || ""}`.toLowerCase();
  return ingredientTerms.filter((term) => text.includes(term)).slice(0, 12);
}

function youtubeSearchUrl(title) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} official song`)}`;
}

function catalogFallbackSummary(item, title) {
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);
  const coordinates = Number.isFinite(latitude) && Number.isFinite(longitude)
    ? `${Math.abs(latitude)}°${latitude >= 0 ? "N" : "S"}, ${Math.abs(longitude)}°${longitude >= 0 ? "E" : "W"}`
    : "the recorded coordinates";
  const classification = cleanText(item.rich_fields?.classification);
  if (item.category === "animal" && /fossil/i.test(classification)) {
    return `${title} is a fossil taxon recorded as ${classification}. Its fossils help researchers compare extinct animals, body forms, and ancient environments. The catalog places this record near ${coordinates}.`;
  }
  const labels = {
    animal: "species of animal",
    food: "dish",
    landmark: "natural or geographic landmark",
    monument: "historic or cultural monument",
    phenomenon: "natural phenomenon",
    movie: "film",
    music: "piece of music",
  };
  const label = labels[item.category] || "learning item";
  if (item.category === "food") {
    const ingredients = (item.rich_fields?.ingredients || [])
      .map((ingredient) => cleanText(ingredient?.name))
      .filter(Boolean)
      .slice(0, 5);
    const ingredientText = ingredients.length
      ? ` Catalogued ingredients include ${ingredients.join(", ")}.`
      : " Its ingredient list is not recorded in the catalog.";
    return `${title} is a ${label} represented in this learning catalog.${ingredientText} These ingredients help learners compare its flavours, textures, and regional preparation traditions.`;
  }
  const classificationText = classification && !isInsufficientContent(classification)
    ? ` The catalog classifies it as ${classification}.`
    : " The catalog records its broad category for comparison with related topics.";
  return `${title} is a ${label} represented in this learning catalog.${classificationText} Its mapped position near ${coordinates} adds geographic context for learners.`;
}

function catalogFallbackSummaryVi(item, title) {
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);
  const coordinates = Number.isFinite(latitude) && Number.isFinite(longitude)
    ? `${Math.abs(latitude)}°${latitude >= 0 ? "B" : "N"}, ${Math.abs(longitude)}°${longitude >= 0 ? "Đ" : "T"}`
    : "tọa độ được ghi nhận";
  const classification = cleanText(item.rich_fields?.classification);
  if (item.category === "animal" && /fossil/i.test(cleanText(item.rich_fields?.classification))) {
    return `${title} là một đơn vị phân loại hóa thạch, được ghi nhận là ${classification}. Hóa thạch giúp các nhà nghiên cứu so sánh động vật đã tuyệt chủng, hình thái cơ thể và môi trường cổ đại. Hồ sơ này nằm gần ${coordinates}.`;
  }
  const labels = {
    animal: "loài động vật",
    food: "món ăn",
    landmark: "địa danh tự nhiên hoặc địa lý",
    monument: "di tích lịch sử hoặc văn hóa",
    phenomenon: "hiện tượng tự nhiên",
    movie: "bộ phim",
    music: "tác phẩm âm nhạc",
  };
  const label = labels[item.category] || "nội dung học tập";
  if (item.category === "food") {
    const ingredients = (item.rich_fields?.ingredients || [])
      .map((ingredient) => cleanText(ingredient?.name))
      .filter(Boolean)
      .slice(0, 5);
    const ingredientText = ingredients.length
      ? ` Các nguyên liệu được ghi nhận gồm ${ingredients.join(", ")}.`
      : " Danh sách nguyên liệu chưa được ghi nhận trong danh mục.";
    return `${title} là một ${label} trong danh mục học tập này.${ingredientText} Những nguyên liệu đó giúp người học so sánh hương vị, kết cấu và cách chế biến theo vùng.`;
  }
  const classificationText = classification && !isInsufficientContent(classification)
    ? ` Danh mục phân loại nội dung này là ${classification}.`
    : " Danh mục ghi nhận nhóm nội dung để so sánh với các chủ đề liên quan.";
  return `${title} là ${label} được ghi nhận trong danh mục học tập này.${classificationText} Vị trí gần ${coordinates} bổ sung bối cảnh địa lý cho người học.`;
}

function hasPlaceholderContent(item) {
  const hasPlaceholderValue = (value) => typeof value === "string" && value.trim() && isInsufficientContent(value);
  const translations = item.translations ?? [];
  return translations.some((translation) => hasPlaceholderValue(translation.description) || hasPlaceholderValue(translation.history))
    || (item.fun_facts ?? []).some((fact) => hasPlaceholderValue(fact))
    || hasPlaceholderValue(item.location_desc);
}

function hasInsufficientSummary(item) {
  return needsBilingualReview(item)
    || needsHistoryRepair(item);
}

function needsHistoryRepair(item) {
  return (item.translations ?? []).some((translation) => {
    const history = translation.history;
    return !history?.trim()
      || isInsufficientContent(history)
      || countWords(history) < 8
      || (translation.lang === "vi" && !isLikelyVietnamese(history));
  });
}

function hasSourceMismatch(item) {
  const sourceUrl = item.rich_fields?.sources?.find((source) => source?.publisher === "English Wikipedia")?.url;
  if (!sourceUrl || !sourceUrl.includes("/wiki/")) return false;
  const sourceTitle = decodeURIComponent(sourceUrl.split("/wiki/")[1] || "").replaceAll("_", " ");
  const expected = normalizedTitle(itemTitle(item)).split(/\s+/u).filter((token) => token.length > 2 && !["the", "and", "of", "in"].includes(token));
  const source = normalizedTitle(sourceTitle);
  return expected.length > 0 && expected.filter((token) => source.includes(token)).length < Math.ceil(expected.length / 2);
}

async function youtubeUrl(title) {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return youtubeSearchUrl(title);
  const body = await apiJson("https://www.googleapis.com/youtube/v3/search", {
    part: "snippet",
    q: title,
    type: "video",
    maxResults: 1,
    safeSearch: "strict",
    key,
  });
  const videoId = body.items?.[0]?.id?.videoId;
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : youtubeSearchUrl(title);
}

function englishSummaryForItem(item, page, wikidataEntity) {
  const titleEn = itemTitle(item);
  const reviewedOverride = reviewedFoodSummaryOverrides.get(titleEn);
  const summaryOverride = reviewedSummaryOverrides.get(titleEn);
  const fetchedSummary = summaryOverride?.en || reviewedOverride || sourceSummary(page) || cleanText(wikidataEntity?.descriptions?.en?.value);
  const currentSummary = item.translations?.find((translation) => translation.lang === "en")?.description;
  const summary = isQualityDescription(fetchedSummary)
    ? fetchedSummary
    : (isQualityDescription(currentSummary) && !isGeneratedEnglishFallback(currentSummary)
      ? currentSummary
      : catalogFallbackSummary(item, titleEn));
  return { summary, fetchedSummary };
}

async function sourceForItem(item, page, viPage, inferredCategory, wikidataEntity, wikidataId, translatedSummary, { allowVietnameseFallback = true, preserveVietnamese = false } = {}) {
  const titleEn = itemTitle(item);
  const summaryOverride = reviewedSummaryOverrides.get(titleEn);
  const { summary, fetchedSummary } = englishSummaryForItem(item, page, wikidataEntity);
  const currentViSummary = item.translations?.find((translation) => translation.lang === "vi")?.description;
  const viPageSummary = sourceSummary(viPage);
  const wikidataViSummary = cleanText(wikidataEntity?.descriptions?.vi?.value);
  const differsFromEnglish = (value) => cleanText(value).toLocaleLowerCase() !== cleanText(summary).toLocaleLowerCase();
  const canPreserveVietnamese = preserveVietnamese
    && !isGeneratedVietnameseFallback(currentViSummary)
    && isQualityDescription(currentViSummary, { language: "vi" });
  const viSummary = canPreserveVietnamese
    ? currentViSummary
    : summaryOverride?.vi
    || (isQualityDescription(viPageSummary, { language: "vi" }) && differsFromEnglish(viPageSummary) ? viPageSummary : "")
    || (isQualityDescription(wikidataViSummary, { language: "vi" }) && differsFromEnglish(wikidataViSummary) ? wikidataViSummary : "")
    || (!isGeneratedVietnameseFallback(currentViSummary)
      && isQualityDescription(currentViSummary, { language: "vi" })
      && differsFromEnglish(currentViSummary) ? currentViSummary : "")
    || (translatedSummary !== undefined ? translatedSummary : await translateToVietnamese(summary))
    || (allowVietnameseFallback ? catalogFallbackSummaryVi(item, titleEn) : "");
  const summarySentences = sentences(summary);
  const history = summaryOverride?.historyEn || summarySentences.slice(1, 3).join(" ") || summarySentences[0] || summary;
  const viSentences = sentences(viSummary);
  const viHistory = summaryOverride?.historyVi || viSentences.slice(1, 3).join(" ") || viSentences[0] || viSummary;
  const funFacts = summaryOverride?.funFactsEn ? [...summaryOverride.funFactsEn] : summarySentences.slice(0, 3);
  while (funFacts.length < 3) {
    const fallbackFacts = [
      `${titleEn} is listed in the ${item.category} category.`,
      `The source summary introduces ${titleEn} as a topic for learning.`,
      `Learners can compare ${titleEn} with related ${item.category} topics.`,
    ];
    funFacts.push(fallbackFacts[funFacts.length] || `${titleEn} has a recorded learning entry.`);
  }
  const titleVi = viPage?.title || item.translations?.find((translation) => translation.lang === "vi")?.title || titleEn;
  const pageUrl = page?.fullurl || wikiUrl(page?.title || titleEn);
  const viPageUrl = viPage ? (viPage.fullurl || wikiUrl(viPage.title, "vi")) : undefined;
  const defaultSources = [
    { url: pageUrl, publisher: "English Wikipedia", source_type: "reference" },
    {
      url: wikidataId || page?.pageprops?.wikibase_item
        ? `https://www.wikidata.org/wiki/${wikidataId || page.pageprops.wikibase_item}`
        : `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(titleEn)}`,
      publisher: "Wikidata",
      source_type: "reference",
    },
    ...(viPageUrl ? [{ url: viPageUrl, publisher: "Vietnamese Wikipedia", source_type: "reference" }] : []),
  ];
  const sources = (reviewedSourceOverrides.get(titleEn) || defaultSources)
    .map((source) => ({ ...source, accessed_at: new Date().toISOString().slice(0, 10) }));
  return {
    titleEn,
    titleVi,
    category: item.category,
    inferredCategory,
    descriptionEn: truncateWords(summary),
    descriptionVi: truncateWords(viSummary || summary),
    historyEn: truncateWords(history),
    historyVi: truncateWords(viHistory || history),
    funFacts,
    locationDescription: summarySentences.slice(0, 2).join(" "),
    ingredients: item.category === "food" ? ingredientCandidates(item, summary) : undefined,
    sources,
    externalSummary: isQualityDescription(fetchedSummary) ? fetchedSummary : "",
    pageUrl,
    viPageUrl,
    wikidataId: wikidataId || page?.pageprops?.wikibase_item,
  };
}

async function readCatalogFiles() {
  return Promise.all(catalogPaths.map(async (filename) => ({
    filename,
    path: resolve(dataDir, filename),
    items: JSON.parse(await readFile(resolve(dataDir, filename), "utf8")),
  })));
}

async function writeProvenance(reviewedByKey, accessedAt) {
  const provenancePath = resolve(dataDir, "expanded-catalog-provenance.json");
  const reportPath = resolve(dataDir, "expanded-catalog-report.json");
  const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
  let reviewed = 0;
  let unresolved = 0;
  const updated = provenance.map((entry) => {
    const source = reviewedByKey.get(entry.item_key);
    if (!source) return entry;
    reviewed += 1;
    if (source.unresolved) unresolved += 1;
    return {
      ...entry,
      title_en: source.titleEn,
      wikidata_id: source.wikidataId || entry.wikidata_id,
      researched_at: accessedAt,
      status: source.unresolved ? "source_not_found" : "reviewed_from_source",
      category_review: source.inferredCategory ? { catalog: source.category, source: source.inferredCategory } : undefined,
      sources: source.sources,
    };
  });
  await writeFile(provenancePath, `${JSON.stringify(updated, null, 2)}\n`);
  let report = {};
  try { report = JSON.parse(await readFile(reportPath, "utf8")); } catch {}
  await writeFile(reportPath, `${JSON.stringify({
    ...report,
    accessed_at: accessedAt,
    source: "Wikimedia MediaWiki Action API, Wikidata, and optional YouTube Data API",
    content_review: { reviewed, unresolved, maximum_summary_words: 150 },
  }, null, 2)}\n`);
  return { reviewed, unresolved };
}

export async function refreshCatalogFiles({ write = false, limit = 0, title = "", category = "", wikidataOnly = false, localOnly = false, sourceOnly = false, onlyInsufficient = false, historyOnly = false, vietnameseOnly = false, englishOnly = false } = {}) {
  const files = await readCatalogFiles();
  const provenancePath = resolve(dataDir, "expanded-catalog-provenance.json");
  let provenance = [];
  try { provenance = JSON.parse(await readFile(provenancePath, "utf8")); } catch {}
  const provenanceByKey = new Map(provenance.map((entry) => [entry.item_key, entry]));
  const allItems = files.flatMap((file) => file.items)
    .filter((item) => !(item.content_review?.approved_at && Array.isArray(item.flashcards)))
    .filter((item) => !title || itemTitle(item) === title)
    .filter((item) => !category || item.category === category)
    .filter((item) => !onlyInsufficient || hasInsufficientSummary(item) || hasSourceMismatch(item))
    .filter((item) => !historyOnly || needsHistoryRepair(item))
    .filter((item) => !vietnameseOnly || needsVietnameseOnlyRepair(item))
    .filter((item) => !englishOnly
      || !isQualityDescription(item.translations?.find((translation) => translation.lang === "en")?.description)
      || isGeneratedEnglishFallback(item.translations?.find((translation) => translation.lang === "en")?.description));
  const selectedItems = limit > 0 ? allItems.slice(0, limit) : allItems;
  const titles = [...new Set(selectedItems.map(itemTitle))];
  const pageTitles = [...new Set(selectedItems.flatMap((item) => [itemTitle(item), wikipediaTitle(item)]))];
  const pages = wikidataOnly || localOnly ? [] : await fetchPages(pageApi, pageTitles);
  const pagesByTitle = pageLookup(pages);
  const initialFullPageTitles = wikidataOnly || localOnly || skipFullExtract ? [] : [...new Set(selectedItems
    .map((item) => bestPage(wikipediaTitle(item), pagesByTitle) || bestPage(itemTitle(item), pagesByTitle))
    .filter((page) => page && countWords(sourceSummary(page)) < 8)
    .map((page) => page.title))];
  if (initialFullPageTitles.length) {
    const fullPages = await fetchPages(pageApi, initialFullPageTitles, { fullExtract: true });
    const fullByTitle = pageLookup(fullPages);
    for (const item of selectedItems) {
      const currentPage = bestPage(wikipediaTitle(item), pagesByTitle) || bestPage(itemTitle(item), pagesByTitle);
      const fullPage = currentPage ? fullByTitle.get(normalizedTitle(currentPage.title)) : null;
      if (fullPage) {
        pagesByTitle.set(normalizedTitle(itemTitle(item)), fullPage);
        pagesByTitle.set(normalizedTitle(wikipediaTitle(item)), fullPage);
      }
    }
  }
  const searchTitles = selectedItems
    .filter((item) => {
      const page = bestPage(wikipediaTitle(item), pagesByTitle) || bestPage(itemTitle(item), pagesByTitle);
      const currentEnglish = item.translations?.find((translation) => translation.lang === "en")?.description;
      return !page || countWords(sourceSummary(page)) < 8 || countWords(currentEnglish) < 8;
    })
    .map(itemTitle);
  const fallbackTitles = wikidataOnly || localOnly ? [] : [...new Set(searchTitles)].slice(0, fallbackLimit);
  if (searchTitles.length > fallbackTitles.length) {
    console.warn(`Skipping ${searchTitles.length - fallbackTitles.length} slow search fallbacks; those items will be reported as unresolved.`);
  }
  const discoveredTitles = await mapConcurrent(fallbackTitles, async (title) => {
    const item = selectedItems.find((candidate) => itemTitle(candidate) === title);
    try {
      const discovered = await searchPage(title, item?.category || "learning item");
      return [title, discovered && searchResultMatches(title, discovered) ? discovered : null];
    } catch (error) {
      console.warn(`Search fallback failed for ${title}: ${error.message}`);
      return [title, null];
    }
  }, fallbackConcurrency);
  const fallbackPairs = discoveredTitles.filter(([, discovered]) => discovered);
  const fallbackPages = fallbackPairs.length
    ? await fetchPages(pageApi, [...new Set(fallbackPairs.map(([, discovered]) => discovered))])
    : [];
  const fallbackByTitle = pageLookup(fallbackPages);
  for (const [originalTitle, discovered] of fallbackPairs) {
    const page = fallbackByTitle.get(normalizedTitle(discovered));
    if (page) pagesByTitle.set(normalizedTitle(originalTitle), page);
  }

  const fullPageTitles = wikidataOnly || localOnly || skipFullExtract ? [] : [...new Set(selectedItems
    .map((item) => bestPage(wikipediaTitle(item), pagesByTitle) || bestPage(itemTitle(item), pagesByTitle))
    .filter((page) => page && countWords(sourceSummary(page)) < 8)
    .map((page) => page.title))];
  if (fullPageTitles.length) {
    const fullPages = await fetchPages(pageApi, fullPageTitles, { fullExtract: true });
    const fullByTitle = pageLookup(fullPages);
    for (const item of selectedItems) {
      const currentPage = bestPage(wikipediaTitle(item), pagesByTitle) || bestPage(itemTitle(item), pagesByTitle);
      const fullPage = currentPage ? fullByTitle.get(normalizedTitle(currentPage.title)) : null;
      if (fullPage) {
        pagesByTitle.set(normalizedTitle(itemTitle(item)), fullPage);
        pagesByTitle.set(normalizedTitle(wikipediaTitle(item)), fullPage);
      }
    }
  }

  const viTitles = wikidataOnly || localOnly || englishOnly ? [] : [...new Set([...pagesByTitle.values()]
    .flatMap((page) => page.langlinks?.filter((link) => link.lang === "vi").map((link) => link.title) || [])
    .filter(Boolean))];
  const viPages = pageLookup(viTitles.length ? await fetchPages(vietnamesePageApi, viTitles, { fullExtract: true }) : []);
  const wikidataCandidates = localOnly
    ? []
    : wikidataOnly
      ? selectedItems.filter((item) => isInsufficientContent(item.translations?.find((translation) => translation.lang === "en")?.description))
      : selectedItems;
  const wikidataIds = [...new Set(wikidataCandidates.map((item) => wikidataIdForItem(item, provenanceByKey)).filter(Boolean))];
  const wikidataEntities = await fetchWikidataEntities(wikidataIds);
  const translationInputs = [];
  for (const item of selectedItems) {
    const title = itemTitle(item);
    const page = bestPage(wikipediaTitle(item), pagesByTitle) || bestPage(title, pagesByTitle);
    const viTitle = page?.langlinks?.find((link) => link.lang === "vi")?.title;
    const viPage = viTitle ? bestPage(viTitle, viPages) : null;
    const entity = wikidataEntities.get(wikidataIdForItem(item, provenanceByKey));
    const { summary } = englishSummaryForItem(item, page, entity);
    const currentVi = item.translations?.find((translation) => translation.lang === "vi")?.description;
    const viSource = sourceSummary(viPage);
    const viWikidata = cleanText(entity?.descriptions?.vi?.value);
    const hasUsableVietnamese = isQualityDescription(viSource, { language: "vi" })
      || isQualityDescription(viWikidata, { language: "vi" })
      || (!isGeneratedVietnameseFallback(currentVi)
        && isQualityDescription(currentVi, { language: "vi" })
        && currentVi.toLocaleLowerCase() !== summary.toLocaleLowerCase());
    if (!reviewedSummaryOverrides.get(title)?.vi && !hasUsableVietnamese) translationInputs.push(summary);
  }
  console.log(`Prepared ${translationInputs.length} translation inputs for ${selectedItems.length} selected items`);
  const translatedSummaries = sourceOnly ? new Map() : await translateToVietnameseBatch(translationInputs);
  const sourcesByKey = new Map();
  let preparedSources = 0;
  const sourceEntries = await mapConcurrent(selectedItems, async (item) => {
    const currentEn = item.translations?.find((translation) => translation.lang === "en");
    const currentVi = item.translations?.find((translation) => translation.lang === "vi");
    if (wikidataOnly && !localOnly && !isInsufficientContent(currentEn?.description) && !isInsufficientContent(currentEn?.history)
      && !isInsufficientContent(currentVi?.description) && !isInsufficientContent(currentVi?.history)) return [itemKey(item), null];
    const title = itemTitle(item);
    const page = bestPage(wikipediaTitle(item), pagesByTitle) || bestPage(title, pagesByTitle);
    const viTitle = page?.langlinks?.find((link) => link.lang === "vi")?.title;
    const viPage = viTitle ? bestPage(viTitle, viPages) : null;
    const summary = sourceSummary(page);
    const wikidataId = wikidataIdForItem(item, provenanceByKey);
    const translatedSummary = sourceOnly
      ? ""
      : translatedSummaries.has(englishSummaryForItem(item, page, wikidataEntities.get(wikidataId)).summary)
      ? translatedSummaries.get(englishSummaryForItem(item, page, wikidataEntities.get(wikidataId)).summary)
      : undefined;
    const source = await sourceForItem(
      item,
      page,
      viPage,
      classifyCatalogCategory(`${title} ${summary} ${wikidataEntities.get(wikidataId)?.descriptions?.en?.value || ""}`),
      wikidataEntities.get(wikidataId),
      wikidataId,
      translatedSummary,
      { allowVietnameseFallback: !sourceOnly && !englishOnly, preserveVietnamese: englishOnly },
    );
    if (sourceOnly && (!isQualityDescription(source.descriptionVi, { language: "vi" })
      || cleanText(source.descriptionVi).toLocaleLowerCase() === cleanText(source.descriptionEn).toLocaleLowerCase())) return [itemKey(item), null];
    source.unresolved = !source.externalSummary;
    if (item.category === "music" && !item.youtube_url) source.youtubeUrl = await youtubeUrl(title);
    preparedSources += 1;
    if (preparedSources % 100 === 0 || preparedSources === selectedItems.length) {
      console.log(`Prepared ${preparedSources}/${selectedItems.length} reviewed source entries`);
    }
    return [itemKey(item), source];
  }, translationConcurrency);
  console.log(`Writing ${sourcesByKey.size || sourceEntries.filter(([, source]) => source).length} reviewed catalog entries`);
  for (const [key, source] of sourceEntries) if (source) sourcesByKey.set(key, source);

  const reviewedByKey = new Map();
  for (const file of files) {
    const updatedItems = file.items.map((item) => {
      const key = itemKey(item);
      const source = sourcesByKey.get(key);
      if (!source) return item;
      const updated = buildReviewedItem(item, source);
      reviewedByKey.set(key, source);
      return updated;
    });
    if (write) await writeFile(file.path, `${JSON.stringify(updatedItems, null, 2)}\n`);
  }

  const accessedAt = new Date().toISOString().slice(0, 10);
  if (write && !category && !limit && !localOnly && !onlyInsufficient) await writeProvenance(reviewedByKey, accessedAt);
  const unresolved = [...sourcesByKey.values()].filter((source) => source.unresolved).length;
  return { total: selectedItems.length, reviewed: selectedItems.length - unresolved, unresolved, write };
}

export async function sanitizeCatalogFiles({ write = false } = {}) {
  const files = await readCatalogFiles();
  let updated = 0;
  for (const file of files) {
    const items = await Promise.all(file.items.map(async (item) => {
      const normalized = normalizeCatalogItem(item);
      const titleEn = itemTitle(item);
      if (!hasPlaceholderContent(item) && !reviewedSummaryOverrides.has(titleEn)) return normalized;
      const source = await sourceForItem(item, null, null, null, null, null);
      source.sources = item.rich_fields?.sources ?? [];
      updated += 1;
      return buildReviewedItem(normalized, source);
    }));
    if (write) await writeFile(file.path, `${JSON.stringify(items, null, 2)}\n`);
  }
  return { total: files.reduce((count, file) => count + file.items.length, 0), updated, write };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Set(process.argv.slice(2));
  if (args.has("--sanitize")) {
    const result = await sanitizeCatalogFiles({ write: args.has("--write") });
    console.log(`${result.write ? "Sanitized and wrote" : "Sanitized"} ${result.total} items; ${result.updated} contained placeholder content.`);
    process.exit(0);
  }
  const limitIndex = process.argv.indexOf("--limit");
  const limit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : 0;
  const categoryIndex = process.argv.indexOf("--category");
  const category = categoryIndex >= 0 ? process.argv[categoryIndex + 1] || "" : "";
  const titleIndex = process.argv.indexOf("--title");
  const title = titleIndex >= 0 ? process.argv[titleIndex + 1] || "" : "";
  const result = await refreshCatalogFiles({
    write: args.has("--write"),
    limit,
    title,
    category,
    wikidataOnly: args.has("--wikidata-only"),
    localOnly: args.has("--local-only"),
    sourceOnly: args.has("--source-only"),
    onlyInsufficient: args.has("--only-insufficient"),
    historyOnly: args.has("--history-only"),
    vietnameseOnly: args.has("--vietnamese-only"),
    englishOnly: args.has("--english-only"),
  });
  console.log(`${result.write ? "Reviewed and wrote" : "Reviewed"} ${result.total} items; ${result.reviewed} source-backed, ${result.unresolved} unresolved.`);
}
