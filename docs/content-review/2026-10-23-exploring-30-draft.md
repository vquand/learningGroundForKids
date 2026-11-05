# Exploring: 30 approved items — lessons, flashcards and quizzes

**Confirmed by the user on 23 October 2026.** The approved content is in the catalog fixtures and the [SQL migration](../migrations/neon-2026-10-23-exploring-content.sql). No production database was changed here. The JSON retains earlier text as an audit snapshot.

Each item has two flashcards and two three-choice quiz questions in each language. Within an item, the four prompts cover different learning objectives. Every correct answer is taught in its revised lesson. Answer keys are shown for review; the eventual child-facing API must keep them server-side.

The old fun-fact lists and standalone location descriptions are proposed for removal: their useful facts are already in the localized lessons. No replacement padding is supplied.

**Import implementation:** the seed uses the explicit authored fronts/backs and retires corresponding obsolete catalog cards and questions. Stable item IDs, saved results and study history are preserved. Automated research refresh skips these approved lessons. Applying the SQL publishes exactly this batch.

For a shorter question-only review, see [the flashcard and quiz pack](2026-10-23-exploring-30-questions.md). Item numbers and stable catalog keys are unchanged.

| # | Item | Category |
|---|---|---|
| 1 | [Polar Bear](#item-1) | animal |
| 2 | [Northern Lights](#item-2) | landmark |
| 3 | [Old Faithful](#item-3) | landmark |
| 4 | [Reed Flute Cave](#item-4) | landmark |
| 5 | [Torres del Paine](#item-5) | landmark |
| 6 | [Mekong River](#item-6) | landmark |
| 7 | [Can Gio Mangrove Forest](#item-7) | landmark |
| 8 | [Phu Quoc National Park](#item-8) | landmark |
| 9 | [Dong Nai River](#item-9) | landmark |
| 10 | [Dau Tieng Reservoir](#item-10) | landmark |
| 11 | [Christ the Redeemer](#item-11) | monument |
| 12 | [Rock-Hewn Churches of Lalibela](#item-12) | monument |
| 13 | [Pyramids of Giza](#item-13) | monument |
| 14 | [Sagrada Familia](#item-14) | monument |
| 15 | [Vinh Trang Temple](#item-15) | monument |
| 16 | [Giác Lâm Pagoda](#item-16) | monument |
| 17 | [Saigon Notre-Dame Basilica](#item-17) | monument |
| 18 | [Tan Dinh church](#item-18) | monument |
| 19 | [Tomb of Khai Dinh](#item-19) | monument |
| 20 | [Ngọ Môn](#item-20) | monument |
| 21 | [Imperial City of Hue](#item-21) | monument |
| 22 | [Perfume Pagoda](#item-22) | monument |
| 23 | [El Niño](#item-23) | phenomenon |
| 24 | [Hailstorm](#item-24) | phenomenon |
| 25 | [Hurricane](#item-25) | phenomenon |
| 26 | [Tsunami](#item-26) | phenomenon |
| 27 | [Waterspout](#item-27) | phenomenon |
| 28 | [Black ice](#item-28) | phenomenon |
| 29 | [Airglow](#item-29) | phenomenon |
| 30 | [Atmospheric refraction](#item-30) | phenomenon |

<a id="item-1"></a>
## 1. Polar Bear / Gấu Bắc Cực

Catalog key: `animal|78|16|Polar Bear`. Status: **approved for SQL publication**.

**English lesson**

Polar bears live in the Arctic and hunt seals from sea ice. Beneath their pale-looking fur, their skin is black. Their large front paws help them swim between patches of ice.

A bear may wait beside a seal’s breathing hole to catch its meal. When sea ice melts earlier, the bear has less time to hunt and build up its energy reserves.

**Bài học tiếng Việt**

Gấu Bắc Cực sống ở vùng Bắc Cực và săn hải cẩu trên băng biển. Dưới bộ lông trông có vẻ trắng là làn da đen. Hai bàn chân trước lớn giúp gấu bơi giữa các mảng băng.

Gấu có thể chờ bên lỗ thở của hải cẩu để bắt mồi. Khi băng biển tan sớm hơn, gấu có ít thời gian săn mồi và tích trữ năng lượng hơn.

**Flashcards / Thẻ ôn tập**

1. **EN:** What do polar bears mainly hunt from sea ice? → **Seals.**
   **VI:** Gấu Bắc Cực chủ yếu săn con gì trên băng biển? → **Hải cẩu.**

2. **EN:** What colour is a polar bear’s skin beneath its fur? → **Black.**
   **VI:** Da gấu Bắc Cực dưới bộ lông có màu gì? → **Màu đen.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Which body part does a polar bear mainly use to paddle while swimming?

- A. Its back paws alone
- B. Its large front paws
- C. Its tail

**Answer: B — Its large front paws**

**Q1 (VI):** Gấu Bắc Cực chủ yếu dùng bộ phận nào để quạt nước khi bơi?

- A. Chỉ hai bàn chân sau
- B. Hai bàn chân trước lớn
- C. Đuôi

**Đáp án: B — Hai bàn chân trước lớn**

**Q2 (EN):** What happens to a polar bear’s hunting time when sea ice melts earlier?

- A. It has more sea ice available for hunting
- B. It mainly switches to hunting penguins
- C. It has less time to hunt seals

**Answer: C — It has less time to hunt seals**

**Q2 (VI):** Khi băng biển tan sớm hơn, thời gian săn mồi của gấu Bắc Cực thay đổi thế nào?

- A. Gấu có nhiều băng biển hơn để săn mồi
- B. Gấu chủ yếu chuyển sang săn chim cánh cụt
- C. Gấu có ít thời gian săn hải cẩu hơn

**Đáp án: C — Gấu có ít thời gian săn hải cẩu hơn**

Sources: [American Museum of Natural History](https://www.amnh.org/explore/ology/ology-cards/288-polar-bear), [WWF — polar bear adaptations](https://www.wwf.org.uk/learn/fascinating-facts/polar-bears).

**Publication note:** Use the polar-bear species reference, not the old disambiguation page. Remove old disambiguation wording from auxiliary fields.

<a id="item-2"></a>
## 2. Northern Lights / Bắc cực quang

Catalog key: `landmark|64.9631|-19.0208|Northern Lights`. Status: **approved for SQL publication**.

**English lesson**

The northern lights are glowing shapes high above Earth. They appear when energetic charged particles collide with gases in the upper atmosphere. Earth’s magnetic field guides many of these particles toward the polar regions.

Oxygen can produce green or red light, while nitrogen can produce blue or pink light. The same kind of display in the Southern Hemisphere is called the southern lights.

**Bài học tiếng Việt**

Bắc cực quang là những dải sáng xuất hiện rất cao trên bầu trời. Chúng hình thành khi các hạt mang điện giàu năng lượng va vào khí ở tầng khí quyển trên cao. Từ trường Trái Đất dẫn nhiều hạt về vùng cực.

Oxy có thể phát ánh sáng xanh lá hoặc đỏ; nitơ có thể phát ánh sáng xanh lam hoặc hồng. Hiện tượng tương tự ở Nam bán cầu được gọi là nam cực quang.

**Flashcards / Thẻ ôn tập**

1. **EN:** What makes gases glow during the northern lights? → **Collisions with energetic charged particles.**
   **VI:** Điều gì làm khí phát sáng trong hiện tượng bắc cực quang? → **Va chạm với các hạt mang điện giàu năng lượng.**

2. **EN:** What guides many aurora-producing particles toward Earth’s polar regions? → **Earth’s magnetic field.**
   **VI:** Điều gì dẫn nhiều hạt tạo cực quang về vùng cực Trái Đất? → **Từ trường Trái Đất.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Which pair of aurora colours can oxygen produce?

- A. Orange and blue
- B. Yellow and violet
- C. Green and red

**Answer: C — Green and red**

**Q1 (VI):** Oxy có thể tạo cặp màu cực quang nào?

- A. Cam và xanh lam
- B. Vàng và tím
- C. Xanh lá và đỏ

**Đáp án: C — Xanh lá và đỏ**

**Q2 (EN):** What is an aurora seen in the Southern Hemisphere called?

- A. The southern lights
- B. The northern lights
- C. Airglow

**Answer: A — The southern lights**

**Q2 (VI):** Cực quang ở Nam bán cầu được gọi là gì?

- A. Nam cực quang
- B. Bắc cực quang
- C. Ánh sáng khí quyển

**Đáp án: A — Nam cực quang**

Sources: [NASA](https://science.nasa.gov/sun/auroras/).

**Publication note:** Retain the stable item key; the northern lights occur over a broad region, not only at the map pin.

<a id="item-3"></a>
## 3. Old Faithful / Mạch nước phun Old Faithful

Catalog key: `landmark|44.4605|-110.8281|Old Faithful`. Status: **approved for SQL publication**.

**English lesson**

Old Faithful is a geyser in Yellowstone National Park in the United States. Underground volcanic heat warms water, which escapes in bursts of hot water and steam through narrow passages in the rock.

Its eruptions are predictable enough for park staff to estimate the next one, but the waiting time changes. It is neither Yellowstone’s largest geyser nor a clock that erupts at one fixed interval.

**Bài học tiếng Việt**

Old Faithful là mạch nước phun trong Vườn quốc gia Yellowstone ở Hoa Kỳ. Nhiệt núi lửa dưới lòng đất làm nóng nước. Nước nóng và hơi nước phun lên qua những lối hẹp trong đá.

Nhân viên vườn quốc gia có thể ước tính lần phun tiếp theo, nhưng thời gian chờ thay đổi. Đây không phải mạch phun lớn nhất Yellowstone và cũng không phun theo một khoảng thời gian cố định.

**Flashcards / Thẻ ôn tập**

1. **EN:** Which national park contains Old Faithful? → **Yellowstone National Park, in the United States.**
   **VI:** Old Faithful nằm trong vườn quốc gia nào? → **Vườn quốc gia Yellowstone ở Hoa Kỳ.**

2. **EN:** What heats the underground water feeding Old Faithful? → **Heat from Yellowstone’s volcanic system.**
   **VI:** Điều gì làm nóng nước ngầm cung cấp cho Old Faithful? → **Nhiệt từ hệ thống núi lửa Yellowstone.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Which statement best describes Old Faithful’s eruption times?

- A. They can be estimated, but intervals vary
- B. They occur at exactly the same minute every hour
- C. They always occur once a day

**Answer: A — They can be estimated, but intervals vary**

**Q1 (VI):** Nhận xét nào đúng nhất về thời điểm Old Faithful phun?

- A. Có thể ước tính nhưng khoảng cách giữa các lần phun thay đổi
- B. Luôn phun đúng cùng một phút trong mỗi giờ
- C. Luôn phun mỗi ngày một lần

**Đáp án: A — Có thể ước tính nhưng khoảng cách giữa các lần phun thay đổi**

**Q2 (EN):** What bursts from Old Faithful’s narrow rock passages?

- A. Molten lava and ash
- B. Hot water and steam
- C. Cold seawater and salt

**Answer: B — Hot water and steam**

**Q2 (VI):** Thứ gì phun ra từ những lối hẹp trong đá của Old Faithful?

- A. Dung nham nóng chảy và tro
- B. Nước nóng và hơi nước
- C. Nước biển lạnh và muối

**Đáp án: B — Nước nóng và hơi nước**

Sources: [US National Park Service](https://home.nps.gov/places/old-faithful-geyser.htm), [US National Park Service — eruption timing](https://www.nps.gov/yell/planyourvisit/exploreoldfaithful.htm).

**Publication note:** Replace the old fixed-interval eruption question. Remove the unsupported geological start year unless independently verified.

<a id="item-4"></a>
## 4. Reed Flute Cave / Động Sáo Sậy

Catalog key: `landmark|25.2369|110.2664|Reed Flute Cave`. Status: **approved for SQL publication**.

**English lesson**

Reed Flute Cave is a limestone cave near Guilin in southern China. Mineral-rich water leaves deposits that form stalactites hanging from the ceiling and stalagmites growing from the floor. These formations can join into stone pillars.

Inscriptions inside the cave include poems and travel records from the Tang dynasty. Coloured lamps illuminate the cave today; they supply the vivid display colours, not the minerals themselves.

**Bài học tiếng Việt**

Động Sáo Sậy là hang đá vôi gần Quế Lâm, miền nam Trung Quốc. Nước mang khoáng chất để lại lớp lắng đọng, tạo nhũ đá rủ từ trần và măng đá mọc từ nền hang. Chúng có thể nối thành cột đá.

Chữ khắc trong hang có thơ và ghi chép của khách đến thăm từ thời nhà Đường. Ngày nay, đèn màu chiếu sáng hang; màu sắc rực rỡ khi tham quan đến từ đèn, không phải màu của khoáng chất.

**Flashcards / Thẻ ôn tập**

1. **EN:** What rock forms Reed Flute Cave near Guilin? → **Limestone.**
   **VI:** Động Sáo Sậy gần Quế Lâm hình thành trong loại đá nào? → **Đá vôi.**

2. **EN:** What evidence shows that people visited Reed Flute Cave during the Tang dynasty? → **Poems and travel records inscribed inside the cave.**
   **VI:** Bằng chứng nào cho thấy người thời Đường đã đến Động Sáo Sậy? → **Thơ và ghi chép của khách được khắc trong hang.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Which formation hangs down from Reed Flute Cave’s ceiling?

- A. A stalagmite
- B. A stalactite
- C. A sand dune

**Answer: B — A stalactite**

**Q1 (VI):** Dạng nào rủ xuống từ trần Động Sáo Sậy?

- A. Măng đá
- B. Nhũ đá
- C. Cồn cát

**Đáp án: B — Nhũ đá**

**Q2 (EN):** What creates the vivid display colours seen during a visit to Reed Flute Cave?

- A. Sunlight passing through the cave roof
- B. Naturally glowing limestone
- C. Coloured lamps

**Answer: C — Coloured lamps**

**Q2 (VI):** Điều gì tạo màu sắc rực rỡ khi tham quan Động Sáo Sậy?

- A. Ánh nắng xuyên qua mái hang
- B. Đá vôi tự phát sáng
- C. Đèn màu

**Đáp án: C — Đèn màu**

Sources: [Visit Guilin](https://visitguilin.org/things-to-do/caves/reed-flute-cave/), [Embassy of China — Reed Flute Park](https://bg.china-embassy.gov.cn/eng/kjwh/kj/200406/t20040613_2368578.htm).

**Publication note:** Keep the distinction between natural formations and coloured visitor lighting.

<a id="item-5"></a>
## 5. Torres del Paine / Torres del Paine

Catalog key: `landmark|-51|-73|Torres del Paine`. Status: **approved for SQL publication**.

**English lesson**

Torres del Paine lies in southern Chile, between the Andes and the Patagonian steppe. Its landscape includes mountains, glaciers, lakes and rivers. Guanacos, wild relatives of llamas, live in the park.

Plants in the wind-exposed scrubland conserve water, while forests grow under different conditions. Torres del Paine became a UNESCO biosphere reserve in 1978.

**Bài học tiếng Việt**

Torres del Paine nằm ở miền nam Chile, giữa dãy Andes và thảo nguyên Patagonia. Cảnh quan có núi, sông băng, hồ và sông. Guanaco, họ hàng hoang dã của lạc đà không bướu llama, sống trong vườn quốc gia.

Cây ở vùng cây bụi nhiều gió có đặc điểm giúp tiết kiệm nước, còn rừng phát triển trong điều kiện khác. Torres del Paine trở thành khu dự trữ sinh quyển UNESCO năm 1978.

**Flashcards / Thẻ ôn tập**

1. **EN:** Between which two landscapes does Torres del Paine lie? → **The Andes and the Patagonian steppe, in southern Chile.**
   **VI:** Torres del Paine nằm giữa hai vùng cảnh quan nào? → **Dãy Andes và thảo nguyên Patagonia, ở miền nam Chile.**

2. **EN:** Which wild relative of the llama lives in Torres del Paine? → **The guanaco.**
   **VI:** Họ hàng hoang dã nào của llama sống ở Torres del Paine? → **Guanaco.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Which trait helps scrubland plants in Torres del Paine cope with strong winds?

- A. Broad, soft leaves that lose water quickly
- B. Roots adapted to permanent tidal flooding
- C. Features that conserve water

**Answer: C — Features that conserve water**

**Q1 (VI):** Đặc điểm nào giúp cây vùng cây bụi Torres del Paine thích nghi với gió mạnh?

- A. Lá rộng, mềm dễ mất nước nhanh
- B. Rễ thích nghi với ngập thủy triều thường xuyên
- C. Đặc điểm giúp tiết kiệm nước

**Đáp án: C — Đặc điểm giúp tiết kiệm nước**

**Q2 (EN):** What UNESCO designation did Torres del Paine receive in 1978?

- A. Biosphere reserve
- B. World Heritage city
- C. Global geopark

**Answer: A — Biosphere reserve**

**Q2 (VI):** Torres del Paine được UNESCO công nhận danh hiệu nào năm 1978?

- A. Khu dự trữ sinh quyển
- B. Thành phố Di sản Thế giới
- C. Công viên địa chất toàn cầu

**Đáp án: A — Khu dự trữ sinh quyển**

Sources: [UNESCO](https://www.unesco.org/en/mab/torres-del-paine), [CONAF — Torres del Paine National Park](https://www.conaf.cl/parque_nacionales/parque-nacional-torres-del-paine/).

**Publication note:** Keep the national park and the larger UNESCO biosphere reserve distinct when reviewing map boundaries.

<a id="item-6"></a>
## 6. Mekong River / Sông Mê Công

Catalog key: `landmark|10.19|106.75|Mekong River`. Status: **approved for SQL publication**.

**English lesson**

The Mekong begins on the Tibetan Plateau and travels through or along six countries: China, Myanmar, Laos, Thailand, Cambodia and Vietnam. Its river system connects mountain streams with floodplains and the Mekong Delta.

The river supports fishing, farming and transport. Its water also carries sediment that helps build and nourish land downstream. Changes upstream can affect communities far away, so neighbouring countries need to cooperate.

**Bài học tiếng Việt**

Sông Mê Công bắt nguồn từ cao nguyên Tây Tạng, chảy qua hoặc dọc biên giới sáu nước: Trung Quốc, Myanmar, Lào, Thái Lan, Campuchia và Việt Nam. Hệ thống sông nối các dòng suối miền núi với đồng bằng và vùng châu thổ.

Dòng sông phục vụ đánh cá, trồng trọt và giao thông. Nước còn mang phù sa giúp bồi đắp và nuôi dưỡng đất ở hạ lưu. Thay đổi ở thượng nguồn có thể ảnh hưởng nơi xa, nên các nước cần hợp tác.

**Flashcards / Thẻ ôn tập**

1. **EN:** Where does the Mekong River begin? → **On the Tibetan Plateau.**
   **VI:** Sông Mê Công bắt nguồn từ đâu? → **Cao nguyên Tây Tạng.**

2. **EN:** How many countries does the Mekong flow through or alongside? → **Six: China, Myanmar, Laos, Thailand, Cambodia and Vietnam.**
   **VI:** Sông Mê Công chảy qua hoặc dọc biên giới bao nhiêu nước? → **Sáu nước: Trung Quốc, Myanmar, Lào, Thái Lan, Campuchia và Việt Nam.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Why is sediment carried by the Mekong important downstream?

- A. It helps build and nourish land
- B. It is the source of the ocean’s salt
- C. It is the force that drives ocean tides

**Answer: A — It helps build and nourish land**

**Q1 (VI):** Vì sao phù sa sông Mê Công quan trọng với vùng hạ lưu?

- A. Giúp bồi đắp và nuôi dưỡng đất
- B. Là nguồn tạo muối của đại dương
- C. Là lực tạo thủy triều

**Đáp án: A — Giúp bồi đắp và nuôi dưỡng đất**

**Q2 (EN):** Why do countries sharing the Mekong need to cooperate?

- A. Each country receives water from an independent source
- B. Upstream changes can affect downstream communities
- C. Only the country at the river mouth uses its water

**Answer: B — Upstream changes can affect downstream communities**

**Q2 (VI):** Vì sao các nước chung dòng Mê Công cần hợp tác?

- A. Mỗi nước nhận nước từ nguồn độc lập
- B. Thay đổi ở thượng nguồn có thể ảnh hưởng cộng đồng hạ lưu
- C. Chỉ nước ở cửa sông sử dụng nước sông

**Đáp án: B — Thay đổi ở thượng nguồn có thể ảnh hưởng cộng đồng hạ lưu**

Sources: [Mekong River Commission](https://www.mrcmekong.org/mekong-river-basin/), [Mekong River Commission — sediment and nutrients](https://pdg.mrcmekong.org/pdg-topic-sediment/).

**Publication note:** The map pin represents one point on a six-country river; it does not define the full river extent.

<a id="item-7"></a>
## 7. Can Gio Mangrove Forest / Rừng ngập mặn Cần Giờ

Catalog key: `landmark|10.31|106.74|Can Gio Mangrove Forest`. Status: **approved for SQL publication**.

**English lesson**

Cần Giờ is a coastal mangrove forest southeast of central Ho Chi Minh City. River water mixes with seawater here, creating brackish water. Its muddy shores support mangrove trees, fish, shellfish and other wildlife.

After wartime destruction, a large replanting programme restored much of the mangrove forest. Cần Giờ became a UNESCO biosphere reserve in 2000.

**Bài học tiếng Việt**

Cần Giờ là rừng ngập mặn ven biển ở phía đông nam trung tâm Thành phố Hồ Chí Minh. Nước sông hòa với nước biển tạo thành nước lợ. Bờ bùn là nơi sống của cây ngập mặn, cá, các loài có vỏ và nhiều động vật khác.

Sau khi rừng bị chiến tranh tàn phá, chương trình trồng lại quy mô lớn đã phục hồi nhiều diện tích rừng ngập mặn. Cần Giờ trở thành khu dự trữ sinh quyển UNESCO năm 2000.

**Flashcards / Thẻ ôn tập**

1. **EN:** What makes the water at Cần Giờ brackish? → **Fresh river water mixes with seawater.**
   **VI:** Điều gì tạo nước lợ ở Cần Giờ? → **Nước ngọt từ sông hòa với nước biển.**

2. **EN:** Which aquatic animals find habitat in Cần Giờ’s mangroves? → **Fish and shellfish.**
   **VI:** Những động vật sống dưới nước nào có nơi ở trong rừng ngập mặn Cần Giờ? → **Cá và các loài có vỏ.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** What helped restore Cần Giờ’s mangroves after wartime destruction?

- A. Draining the tidal wetlands for farmland
- B. A large tree-replanting programme
- C. Replacing mangroves with upland pine forests

**Answer: B — A large tree-replanting programme**

**Q1 (VI):** Điều gì giúp rừng ngập mặn Cần Giờ phục hồi sau chiến tranh?

- A. Rút nước vùng ngập triều để làm ruộng
- B. Chương trình trồng lại cây quy mô lớn
- C. Thay rừng ngập mặn bằng rừng thông vùng cao

**Đáp án: B — Chương trình trồng lại cây quy mô lớn**

**Q2 (EN):** In which year did Cần Giờ become a UNESCO biosphere reserve?

- A. 1978
- B. 1993
- C. 2000

**Answer: C — 2000**

**Q2 (VI):** Cần Giờ trở thành khu dự trữ sinh quyển UNESCO vào năm nào?

- A. 1978
- B. 1993
- C. 2000

**Đáp án: C — 2000**

Sources: [UNESCO](https://www.unesco.org/en/mab/can-gio-mangrove), [FAO — mangrove reforestation in Cần Giờ](https://www.fao.org/4/y2795e/y2795e11.htm).

**Publication note:** Retain Cần Giờ’s 2000 biosphere designation; do not confuse it with Huế’s 1993 World Heritage inscription.

<a id="item-8"></a>
## 8. Phu Quoc National Park / Vườn quốc gia Phú Quốc

Catalog key: `landmark|10.325|103.95|Phu Quoc National Park`. Status: **approved for SQL publication**.

**English lesson**

Phú Quốc National Park protects wooded hills and streams in the north of Phú Quốc Island. Its habitats include evergreen broadleaf forest, Melaleuca forest and mangroves.

Mangroves grow along salty, tidal coasts; evergreen forest grows inland.

**Bài học tiếng Việt**

Vườn quốc gia Phú Quốc bảo vệ đồi rừng và suối ở phía bắc đảo Phú Quốc. Các sinh cảnh có rừng lá rộng thường xanh, rừng tràm và rừng ngập mặn.

Rừng ngập mặn mọc ven biển có nước mặn và thủy triều; rừng thường xanh phát triển trong đất liền.

**Flashcards / Thẻ ôn tập**

1. **EN:** Which part of Phú Quốc Island contains the national park’s forests? → **The northern part.**
   **VI:** Rừng của Vườn quốc gia Phú Quốc nằm ở phần nào của đảo? → **Phần phía bắc.**

2. **EN:** Besides evergreen forest and mangroves, which forest type occurs in Phú Quốc National Park? → **Melaleuca forest.**
   **VI:** Ngoài rừng thường xanh và rừng ngập mặn, Vườn quốc gia Phú Quốc có kiểu rừng nào? → **Rừng tràm.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Which Phú Quốc habitat grows along salty, tidal shores?

- A. Inland evergreen forest
- B. Alpine meadow
- C. Mangrove forest

**Answer: C — Mangrove forest**

**Q1 (VI):** Sinh cảnh nào ở Phú Quốc mọc ven bờ có nước mặn và thủy triều?

- A. Rừng thường xanh trong đất liền
- B. Đồng cỏ núi cao
- C. Rừng ngập mặn

**Đáp án: C — Rừng ngập mặn**

**Q2 (EN):** Which freshwater feature runs through Phú Quốc National Park’s wooded hills?

- A. Streams
- B. Glaciers
- C. Alpine snowfields

**Answer: A — Streams**

**Q2 (VI):** Dạng nước ngọt nào chảy qua đồi rừng của Vườn quốc gia Phú Quốc?

- A. Suối
- B. Sông băng
- C. Cánh đồng tuyết núi cao

**Đáp án: A — Suối**

Sources: [An Giang tourism portal](https://tourism.angiang.gov.vn/destination/detail/1297), [Special-use forests in Vietnam — forest habitat reference](https://snrd-asia.org/wp-content/uploads/2024/11/1-Special-Used-Forests-in-Vietnam-2021_EN.pdf).

**Publication note:** Use Phú Quốc National Park’s forest habitats; do not substitute lessons about the island’s resorts or unrelated beaches.

<a id="item-9"></a>
## 9. Dong Nai River / Sông Đồng Nai

Catalog key: `landmark|10.93028|106.82389|Dong Nai River`. Status: **approved for SQL publication**.

**English lesson**

The Đồng Nai River’s headwaters rise in the mountainous Lang Biang region of southern Vietnam. The river flows from the highlands toward the lowlands near Ho Chi Minh City.

Its basin includes the main river, tributaries and land draining into them. Forest cover in the headwaters helps limit soil erosion, reducing the soil washed into streams after rain.

**Bài học tiếng Việt**

Đầu nguồn sông Đồng Nai nằm ở miền núi Lang Biang, phía nam Việt Nam. Sông chảy từ cao nguyên xuống vùng thấp gần Thành phố Hồ Chí Minh.

Lưu vực gồm dòng chính, các nhánh sông và vùng đất có nước chảy vào chúng. Rừng đầu nguồn giúp hạn chế xói mòn đất, giảm lượng đất bị nước mưa cuốn xuống suối.

**Flashcards / Thẻ ôn tập**

1. **EN:** Which mountainous region contains the Đồng Nai River’s headwaters? → **Lang Biang.**
   **VI:** Đầu nguồn sông Đồng Nai nằm ở miền núi nào? → **Lang Biang.**

2. **EN:** What belongs to the Đồng Nai River basin besides the main river? → **Its tributaries and the land draining into them.**
   **VI:** Ngoài dòng chính, lưu vực sông Đồng Nai còn gồm những gì? → **Các nhánh sông và vùng đất có nước chảy vào chúng.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** How does headwater forest help protect streams in the Đồng Nai basin?

- A. It limits soil erosion after rain
- B. It adds seawater to the headwaters
- C. It changes the river’s source to the lowlands

**Answer: A — It limits soil erosion after rain**

**Q1 (VI):** Rừng đầu nguồn giúp bảo vệ suối trong lưu vực Đồng Nai như thế nào?

- A. Hạn chế đất bị xói mòn sau mưa
- B. Đưa nước biển vào đầu nguồn
- C. Chuyển đầu nguồn sông xuống vùng thấp

**Đáp án: A — Hạn chế đất bị xói mòn sau mưa**

**Q2 (EN):** Which route describes the Đồng Nai River’s flow?

- A. From coastal lowlands uphill toward Lang Biang
- B. From the highlands toward lowlands near Ho Chi Minh City
- C. From the Tibetan Plateau toward the Mekong Delta

**Answer: B — From the highlands toward lowlands near Ho Chi Minh City**

**Q2 (VI):** Hướng chảy nào mô tả sông Đồng Nai?

- A. Từ vùng thấp ven biển ngược lên Lang Biang
- B. Từ cao nguyên xuống vùng thấp gần Thành phố Hồ Chí Minh
- C. Từ cao nguyên Tây Tạng về Đồng bằng sông Cửu Long

**Đáp án: B — Từ cao nguyên xuống vùng thấp gần Thành phố Hồ Chí Minh**

Sources: [Vietnam Nature and Biodiversity Conservation Agency](https://nbca.gov.vn/du-an-br/khu-du-tru-sinh-quyen/khu-dtsq-lang-biang/), [US Forest Service — forest cover and erosion](https://www.srs.fs.usda.gov/pubs/gtr/gtr_srs162.pdf), [US Geological Survey — watersheds and drainage basins](https://www.usgs.gov/special-topics/water-science-school/science/watersheds-and-drainage-basins).

**Publication note:** The forest/erosion explanation is an application of the cited watershed science to Đồng Nai, not a measured local runoff claim.

<a id="item-10"></a>
## 10. Dau Tieng Reservoir / Hồ Dầu Tiếng

Catalog key: `landmark|11.38417|106.36361|Dau Tieng Reservoir`. Status: **approved for SQL publication**.

**English lesson**

Dầu Tiếng is a reservoir in southern Vietnam, created by holding water behind a dam. Its irrigation system carries water to farmland. The reservoir also supplies water for treatment plants serving towns and cities.

Freshwater released downstream helps push salty water back during dry periods.

**Bài học tiếng Việt**

Dầu Tiếng là hồ chứa ở miền nam Việt Nam, được tạo bằng cách giữ nước sau đập. Hệ thống thủy lợi đưa nước đến đồng ruộng. Hồ còn cấp nước cho các nhà máy xử lý nước phục vụ đô thị.

Nước ngọt xả xuống hạ lưu giúp đẩy nước mặn trở lại trong thời kỳ khô hạn.

**Flashcards / Thẻ ôn tập**

1. **EN:** What structure holds back water to create Dầu Tiếng Reservoir? → **A dam.**
   **VI:** Công trình nào giữ nước để tạo hồ Dầu Tiếng? → **Đập.**

2. **EN:** How does Dầu Tiếng water reach farmland? → **Through an irrigation system.**
   **VI:** Nước hồ Dầu Tiếng đến đồng ruộng bằng cách nào? → **Qua hệ thống thủy lợi.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Which urban service also receives water from Dầu Tiếng?

- A. Seawater desalination plants
- B. Water-treatment plants
- C. Tidal power stations

**Answer: B — Water-treatment plants**

**Q1 (VI):** Dịch vụ đô thị nào cũng nhận nước từ hồ Dầu Tiếng?

- A. Nhà máy khử mặn nước biển
- B. Nhà máy xử lý nước
- C. Nhà máy điện thủy triều

**Đáp án: B — Nhà máy xử lý nước**

**Q2 (EN):** Why release freshwater downstream from Dầu Tiếng during dry periods?

- A. To supply saltwater to inland crop fields
- B. To move seawater farther upstream
- C. To help push salty water back

**Answer: C — To help push salty water back**

**Q2 (VI):** Vì sao xả nước ngọt từ Dầu Tiếng xuống hạ lưu trong thời kỳ khô hạn?

- A. Để cấp nước mặn cho ruộng trong đất liền
- B. Để đưa nước biển sâu hơn vào thượng lưu
- C. Để góp phần đẩy nước mặn trở lại

**Đáp án: C — Để góp phần đẩy nước mặn trở lại**

Sources: [Vietnam Institute of Water Resources Planning](https://iwrp.gov.vn/newsdetail/dieu-it-biet-ve-4-cong-trinh-thuy-loi-quan-trong-dac-biet-1622.html), [Vietnam Ministry of Agriculture and Environment — Dầu Tiếng irrigation](https://en.mae.gov.vn/Pages/chi-tiet-tin-Eng.aspx?ItemID=9206).

**Publication note:** Keep crop irrigation, drinking-water treatment supply and saltwater management distinct; do not describe reservoir water as treated drinking water.

<a id="item-11"></a>
## 11. Christ the Redeemer / Tượng Chúa Kitô Cứu Thế

Catalog key: `monument|-22.9519|-43.2105|Christ the Redeemer`. Status: **approved for SQL publication**.

**English lesson**

Christ the Redeemer stands with outstretched arms on Corcovado mountain above Rio de Janeiro, Brazil. The statue is an example of Art Deco, a style that often uses bold, simplified shapes.

Brazilian engineer Heitor da Silva Costa led the project. Construction began in 1926, and the statue opened in 1931.

**Bài học tiếng Việt**

Tượng Chúa Kitô Cứu Thế dang hai tay trên núi Corcovado, phía trên thành phố Rio de Janeiro, Brazil. Tượng thuộc phong cách Art Deco, thường dùng những hình khối rõ nét và giản lược.

Kỹ sư Brazil Heitor da Silva Costa phụ trách dự án. Công trình bắt đầu xây năm 1926 và khánh thành năm 1931.

**Flashcards / Thẻ ôn tập**

1. **EN:** On which mountain does Christ the Redeemer stand? → **Corcovado, above Rio de Janeiro.**
   **VI:** Tượng Chúa Kitô Cứu Thế đứng trên núi nào? → **Núi Corcovado, phía trên Rio de Janeiro.**

2. **EN:** Which artistic style is used for Christ the Redeemer? → **Art Deco, with bold, simplified shapes.**
   **VI:** Tượng Chúa Kitô Cứu Thế thuộc phong cách nghệ thuật nào? → **Art Deco, với hình khối rõ nét và giản lược.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** In which year did Christ the Redeemer open?

- A. 1926
- B. 1882
- C. 1931

**Answer: C — 1931**

**Q1 (VI):** Tượng Chúa Kitô Cứu Thế khánh thành năm nào?

- A. 1926
- B. 1882
- C. 1931

**Đáp án: C — 1931**

**Q2 (EN):** Who led construction of Christ the Redeemer?

- A. Heitor da Silva Costa
- B. Antoni Gaudí
- C. Gustave Eiffel

**Answer: A — Heitor da Silva Costa**

**Q2 (VI):** Ai phụ trách xây dựng tượng Chúa Kitô Cứu Thế?

- A. Heitor da Silva Costa
- B. Antoni Gaudí
- C. Gustave Eiffel

**Đáp án: A — Heitor da Silva Costa**

Sources: [Riotur — Rio municipal tourism](https://riotur.rio/en/que_fazer/christtheredeemer/).

**Publication note:** Keep 1926 as the start of construction and 1931 as the opening year.

<a id="item-12"></a>
## 12. Rock-Hewn Churches of Lalibela / Các nhà thờ đục trong đá ở Lalibela

Catalog key: `monument|12.0317|39.0473|Rock-Hewn Churches of Lalibela`. Status: **approved for SQL publication**.

**English lesson**

Lalibela in Ethiopia has eleven medieval churches carved from rock. Builders removed stone to create walls, doorways and rooms, rather than stacking blocks to make the buildings.

The churches are linked by passages and trenches and remain important places of Christian pilgrimage. Their design is associated with King Lalibela’s vision of a New Jerusalem in Ethiopia.

**Bài học tiếng Việt**

Lalibela ở Ethiopia có mười một nhà thờ thời trung cổ được đục từ đá. Thợ xây lấy đá đi để tạo tường, cửa và phòng, thay vì chồng các khối đá lên thành công trình.

Các nhà thờ nối với nhau bằng lối đi và hào, đồng thời vẫn là nơi hành hương quan trọng của tín đồ Kitô giáo. Thiết kế gắn với ý tưởng của vua Lalibela về một Jerusalem mới tại Ethiopia.

**Flashcards / Thẻ ôn tập**

1. **EN:** How many medieval rock-hewn churches make up the Lalibela group? → **Eleven.**
   **VI:** Quần thể nhà thờ đục trong đá thời trung cổ ở Lalibela có bao nhiêu nhà thờ? → **Mười một.**

2. **EN:** How did builders create rooms in Lalibela’s rock-hewn churches? → **They cut away rock to leave walls, openings and rooms.**
   **VI:** Thợ xây tạo phòng trong các nhà thờ đá Lalibela bằng cách nào? → **Đục bỏ đá để tạo tường, cửa và phòng.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** What links the churches at Lalibela?

- A. Passages and trenches
- B. Boating canals
- C. Raised wooden walkways

**Answer: A — Passages and trenches**

**Q1 (VI):** Điều gì nối các nhà thờ tại Lalibela?

- A. Lối đi và hào
- B. Kênh dành cho thuyền
- C. Lối gỗ trên cao

**Đáp án: A — Lối đi và hào**

**Q2 (EN):** Which idea is traditionally associated with King Lalibela’s churches?

- A. Rebuilding a Roman forum
- B. Creating a New Jerusalem
- C. Recreating Giza’s royal pyramids

**Answer: B — Creating a New Jerusalem**

**Q2 (VI):** Ý tưởng nào theo truyền thống gắn với các nhà thờ của vua Lalibela?

- A. Dựng lại quảng trường La Mã
- B. Tạo một Jerusalem mới
- C. Tái tạo kim tự tháp hoàng gia Giza

**Đáp án: B — Tạo một Jerusalem mới**

Sources: [UNESCO World Heritage Centre](https://whc.unesco.org/en/list/18/).

**Publication note:** Present the New Jerusalem association as historical tradition, not a directly proven design instruction from the king.

<a id="item-13"></a>
## 13. Pyramids of Giza / Các kim tự tháp Giza

Catalog key: `monument|29.9792|31.1342|Pyramids of Giza`. Status: **approved for SQL publication**.

**English lesson**

The three main pyramids at Giza stand near Cairo in Egypt. They were built as royal tombs for Khufu, Khafre and Menkaure during the Old Kingdom, more than four thousand years ago.

The largest is the Great Pyramid of Khufu. Each main pyramid belonged to a burial complex that also included temples and other structures.

**Bài học tiếng Việt**

Ba kim tự tháp chính ở Giza nằm gần Cairo, Ai Cập. Chúng được xây làm lăng cho các vua Khufu, Khafre và Menkaure vào thời Cổ Vương quốc, cách đây hơn bốn nghìn năm.

Lớn nhất là Đại kim tự tháp của vua Khufu. Mỗi kim tự tháp chính thuộc một quần thể mai táng có cả đền và các công trình khác.

**Flashcards / Thẻ ôn tập**

1. **EN:** For which ruler was Giza’s largest pyramid built? → **Khufu.**
   **VI:** Kim tự tháp lớn nhất Giza được xây cho vị vua nào? → **Khufu.**

2. **EN:** What was the purpose of Giza’s three main pyramids? → **They were royal tombs.**
   **VI:** Ba kim tự tháp chính ở Giza được dùng làm gì? → **Lăng mộ hoàng gia.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** During which period were the three main pyramids of Giza built?

- A. The New Kingdom
- B. The Old Kingdom
- C. The Ptolemaic period

**Answer: B — The Old Kingdom**

**Q1 (VI):** Ba kim tự tháp chính ở Giza được xây trong thời kỳ nào?

- A. Tân Vương quốc
- B. Cổ Vương quốc
- C. Thời Ptolemaios

**Đáp án: B — Cổ Vương quốc**

**Q2 (EN):** What else belonged to Giza’s pyramid burial complexes?

- A. Roman bathhouses
- B. Greek theatres
- C. Temples

**Answer: C — Temples**

**Q2 (VI):** Ngoài kim tự tháp, quần thể mai táng Giza còn có công trình nào?

- A. Nhà tắm La Mã
- B. Nhà hát Hy Lạp
- C. Đền

**Đáp án: C — Đền**

Sources: [UNESCO World Heritage Centre](https://whc.unesco.org/en/list/86/).

**Publication note:** Remove the false claim that Giza has the world’s largest collection of pyramids.

<a id="item-14"></a>
## 14. Sagrada Familia / Vương cung thánh đường Sagrada Família

Catalog key: `monument|41.4036|2.1744|Sagrada Familia`. Status: **approved for SQL publication**.

**English lesson**

Sagrada Família is a basilica in Barcelona, Spain, designed largely by Antoni Gaudí. Inside, stone columns branch like trees to support the roof.

Construction began in 1882. Gaudí took over the project in 1883.

**Bài học tiếng Việt**

Sagrada Família là vương cung thánh đường ở Barcelona, Tây Ban Nha, phần lớn do Antoni Gaudí thiết kế. Bên trong, cột đá chia nhánh như cây để đỡ mái.

Công trình khởi công năm 1882. Gaudí tiếp nhận dự án năm 1883.

**Flashcards / Thẻ ôn tập**

1. **EN:** Which architect developed most of the design of Sagrada Família? → **Antoni Gaudí.**
   **VI:** Kiến trúc sư nào phát triển phần lớn thiết kế Sagrada Família? → **Antoni Gaudí.**

2. **EN:** In which Spanish city is Sagrada Família? → **Barcelona.**
   **VI:** Sagrada Família nằm ở thành phố nào của Tây Ban Nha? → **Barcelona.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Why do Sagrada Família’s interior columns branch like trees?

- A. To collect rainwater for canals
- B. To hold the bells outside the building
- C. To support the roof

**Answer: C — To support the roof**

**Q1 (VI):** Vì sao cột bên trong Sagrada Família chia nhánh như cây?

- A. Để gom nước mưa cho kênh
- B. Để treo chuông bên ngoài công trình
- C. Để đỡ mái

**Đáp án: C — Để đỡ mái**

**Q2 (EN):** Which event happened in 1882, before Gaudí took over the project?

- A. Construction of Sagrada Família began
- B. Gaudí took over the project
- C. Gaudí died and successors took over

**Answer: A — Construction of Sagrada Família began**

**Q2 (VI):** Sự kiện nào xảy ra năm 1882, trước khi Gaudí tiếp nhận dự án?

- A. Sagrada Família khởi công
- B. Gaudí tiếp nhận dự án
- C. Gaudí qua đời và những người kế nhiệm tiếp tục

**Đáp án: A — Sagrada Família khởi công**

Sources: [Sagrada Família — official site](https://sagradafamilia.org/en/history-of-the-temple), [Sagrada Família — branching columns](https://blog.sagradafamilia.org/en/columns-sagrada-familia-geometry-mechanics-materials-stone-forest/).

**Publication note:** Keep the 1882 construction start distinct from Gaudí’s 1883 takeover; no completion prediction is included.

<a id="item-15"></a>
## 15. Vinh Trang Temple / Chùa Vĩnh Tràng

Catalog key: `monument|10.362809|106.373749|Vinh Trang Temple`. Status: **approved for SQL publication**.

**English lesson**

Vĩnh Tràng is a Buddhist pagoda in Mỹ Tho in the Mekong Delta. Its halls form a layout resembling the character Quốc (国). The exterior combines Vietnamese decoration with Asian and European architectural details, including arched doorways.

The pagoda began in the nineteenth century. The monk Huệ Đăng rebuilt it in 1849.

**Bài học tiếng Việt**

Vĩnh Tràng là chùa Phật giáo ở Mỹ Tho, Đồng bằng sông Cửu Long. Các gian nhà bố trí theo hình chữ Quốc (国). Bên ngoài kết hợp trang trí Việt Nam với chi tiết kiến trúc Á và Âu, trong đó có cửa vòm.

Chùa có từ thế kỷ mười chín. Hòa thượng Huệ Đăng xây dựng lại chùa năm 1849.

**Flashcards / Thẻ ôn tập**

1. **EN:** In which Mekong Delta city is Vĩnh Tràng Pagoda? → **Mỹ Tho.**
   **VI:** Chùa Vĩnh Tràng nằm ở thành phố nào của Đồng bằng sông Cửu Long? → **Mỹ Tho.**

2. **EN:** Which monk rebuilt Vĩnh Tràng Pagoda in 1849? → **Huệ Đăng.**
   **VI:** Hòa thượng nào xây dựng lại chùa Vĩnh Tràng năm 1849? → **Huệ Đăng.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Which description fits Vĩnh Tràng’s exterior?

- A. Vietnamese decoration with Asian and European details
- B. A design limited to European Gothic forms
- C. A design limited to Indian rock-cut forms

**Answer: A — Vietnamese decoration with Asian and European details**

**Q1 (VI):** Mô tả nào phù hợp với bên ngoài chùa Vĩnh Tràng?

- A. Trang trí Việt Nam kết hợp chi tiết Á và Âu
- B. Thiết kế chỉ dùng hình thức Gothic châu Âu
- C. Thiết kế chỉ dùng hình thức đục trong đá của Ấn Độ

**Đáp án: A — Trang trí Việt Nam kết hợp chi tiết Á và Âu**

**Q2 (EN):** Which character does the layout of Vĩnh Tràng’s halls resemble?

- A. Nhân (人)
- B. Quốc (国)
- C. Sơn (山)

**Answer: B — Quốc (国)**

**Q2 (VI):** Bố cục các gian chùa Vĩnh Tràng giống chữ nào?

- A. Nhân (人)
- B. Quốc (国)
- C. Sơn (山)

**Đáp án: B — Quốc (国)**

Sources: [Vietnam Government Committee for Religious Affairs](https://religion.vn/religious-life-and-style/unique-architecture-of-vinh-trang-pagoda-in-tien-giang-postrxqe2mrn8y.html).

**Publication note:** Keep Mỹ Tho and the 1849 rebuilding by Huệ Đăng; do not call every architectural detail European.

<a id="item-16"></a>
## 16. Giác Lâm Pagoda / Chùa Giác Lâm

Catalog key: `monument|10.779444|106.649167|Giác Lâm Pagoda`. Status: **approved for SQL publication**.

**English lesson**

Giác Lâm is a Buddhist pagoda in Ho Chi Minh City. Its halls contain gilded wooden statues, and a bodhi tree grows in the surrounding garden.

Lý Thụy Long founded the pagoda in 1744.

**Bài học tiếng Việt**

Giác Lâm là chùa Phật giáo ở Thành phố Hồ Chí Minh. Các gian thờ có tượng gỗ thếp vàng; trong vườn quanh chùa có cây bồ đề.

Ông Lý Thụy Long lập chùa năm 1744.

**Flashcards / Thẻ ôn tập**

1. **EN:** In which year was Giác Lâm Pagoda founded? → **1744.**
   **VI:** Chùa Giác Lâm được lập vào năm nào? → **1744.**

2. **EN:** Who founded Giác Lâm Pagoda? → **Lý Thụy Long.**
   **VI:** Ai lập chùa Giác Lâm? → **Lý Thụy Long.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Which finish decorates wooden statues at Giác Lâm Pagoda?

- A. Coloured-glass mosaic
- B. Gold leaf
- C. Blue glazed tiles

**Answer: B — Gold leaf**

**Q1 (VI):** Tượng gỗ ở chùa Giác Lâm được trang trí bằng cách nào?

- A. Ghép thủy tinh màu
- B. Thếp vàng
- C. Ốp ngói men xanh

**Đáp án: B — Thếp vàng**

**Q2 (EN):** Which tree grows in the garden at Giác Lâm Pagoda?

- A. An olive tree
- B. A baobab
- C. A bodhi tree

**Answer: C — A bodhi tree**

**Q2 (VI):** Trong vườn chùa Giác Lâm có cây gì?

- A. Cây ô liu
- B. Cây bao báp
- C. Cây bồ đề

**Đáp án: C — Cây bồ đề**

Sources: [Wikipedia — Giác Lâm Temple](https://en.wikipedia.org/wiki/Gi%C3%A1c_L%C3%A2m_Temple), [Vietnam Buddhist Sangha portal — Giác Lâm history](https://phatgiao.org.vn/tu-dien-phat-hoc-online/giac-lam-k52555.html).

**Publication note:** Use “gilded wooden statues” without claiming that every statue has the same material or a disputed exact statue count.

<a id="item-17"></a>
## 17. Saigon Notre-Dame Basilica / Nhà thờ Đức Bà Sài Gòn

Catalog key: `monument|10.779722|106.699167|Saigon Notre-Dame Basilica`. Status: **approved for SQL publication**.

**English lesson**

Notre-Dame Cathedral Basilica of Saigon is a Catholic cathedral in central Ho Chi Minh City. It has red-brick walls and two bell towers.

The cathedral was built between 1877 and 1880 using construction materials imported from France.

**Bài học tiếng Việt**

Nhà thờ Đức Bà Sài Gòn là nhà thờ chính tòa Công giáo ở trung tâm Thành phố Hồ Chí Minh. Công trình có tường gạch đỏ và hai tháp chuông.

Nhà thờ được xây từ năm 1877 đến năm 1880, sử dụng vật liệu xây dựng nhập từ Pháp.

**Flashcards / Thẻ ôn tập**

1. **EN:** When was Saigon’s Notre-Dame Cathedral built? → **Between 1877 and 1880.**
   **VI:** Nhà thờ Đức Bà Sài Gòn được xây khi nào? → **Từ năm 1877 đến năm 1880.**

2. **EN:** How many bell towers does Saigon’s Notre-Dame Cathedral have? → **Two.**
   **VI:** Nhà thờ Đức Bà Sài Gòn có bao nhiêu tháp chuông? → **Hai.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Which material gives Saigon’s Notre-Dame Cathedral its red walls?

- A. Red sandstone
- B. Painted timber
- C. Brick

**Answer: C — Brick**

**Q1 (VI):** Vật liệu nào tạo nên tường đỏ của Nhà thờ Đức Bà Sài Gòn?

- A. Đá sa thạch đỏ
- B. Gỗ sơn đỏ
- C. Gạch

**Đáp án: C — Gạch**

**Q2 (EN):** From which country were construction materials imported for Saigon’s Notre-Dame Cathedral?

- A. France
- B. Spain
- C. Portugal

**Answer: A — France**

**Q2 (VI):** Vật liệu xây dựng Nhà thờ Đức Bà Sài Gòn được nhập từ nước nào?

- A. Pháp
- B. Tây Ban Nha
- C. Bồ Đào Nha

**Đáp án: A — Pháp**

Sources: [Wikipedia — Notre-Dame Cathedral Basilica of Saigon](https://en.wikipedia.org/wiki/Notre-Dame_Cathedral_Basilica_of_Saigon).

**Publication note:** The 1877–1880 dates describe the cathedral’s initial construction, not the later bell-tower spires.

<a id="item-18"></a>
## 18. Tan Dinh church / Nhà thờ Tân Định

Catalog key: `monument|10.788417|106.690694|Tan Dinh church`. Status: **approved for SQL publication**.

**English lesson**

Tân Định Church stands on Hai Bà Trưng Street in Ho Chi Minh City. Its Romanesque design includes Gothic and Renaissance elements, with arched openings and a tall bell tower.

The church opened in 1876. It acquired its distinctive pink exterior during renovation in 1957.

**Bài học tiếng Việt**

Nhà thờ Tân Định nằm trên đường Hai Bà Trưng, Thành phố Hồ Chí Minh. Thiết kế Romanesque kết hợp các yếu tố Gothic và Phục Hưng, với cửa vòm và tháp chuông cao.

Nhà thờ khánh thành năm 1876. Màu hồng đặc trưng bên ngoài xuất hiện trong đợt tu sửa năm 1957.

**Flashcards / Thẻ ôn tập**

1. **EN:** On which street in Ho Chi Minh City does Tân Định Church stand? → **Hai Bà Trưng Street.**
   **VI:** Nhà thờ Tân Định nằm trên đường nào ở Thành phố Hồ Chí Minh? → **Đường Hai Bà Trưng.**

2. **EN:** In which year was Tân Định Church repainted pink? → **1957.**
   **VI:** Nhà thờ Tân Định được sơn hồng vào năm nào? → **1957.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** What happened at Tân Định Church in 1876?

- A. The church opened
- B. Its exterior was first painted pink
- C. Its Romanesque design was replaced with Art Deco

**Answer: A — The church opened**

**Q1 (VI):** Sự kiện nào xảy ra với Nhà thờ Tân Định năm 1876?

- A. Nhà thờ khánh thành
- B. Bên ngoài được sơn hồng lần đầu
- C. Thiết kế Romanesque được thay bằng Art Deco

**Đáp án: A — Nhà thờ khánh thành**

**Q2 (EN):** Which style forms the basis of Tân Định Church’s design?

- A. Art Deco, with streamlined geometric forms
- B. Romanesque, with Gothic and Renaissance elements
- C. Brutalism, with exposed concrete masses

**Answer: B — Romanesque, with Gothic and Renaissance elements**

**Q2 (VI):** Phong cách nào là nền tảng thiết kế Nhà thờ Tân Định?

- A. Art Deco, với hình khối hình học giản lược
- B. Romanesque, kết hợp yếu tố Gothic và Phục Hưng
- C. Thô mộc, với các khối bê tông để lộ

**Đáp án: B — Romanesque, kết hợp yếu tố Gothic và Phục Hưng**

Sources: [Ho Chi Minh City official tourism portal](https://visithcmc.net/en/news/kham-pha-nha-tho-tan-dinh-net-hong-doc-dao-dep-nhat-sai-gon), [Tim Doling — history of Tân Định Church](https://www.historicvietnam.com/tan-dinh-church/).

**Publication note:** The 1876 opening and 1957 pink renovation are different events; preserve that distinction.

<a id="item-19"></a>
## 19. Tomb of Khai Dinh / Lăng Khải Định

Catalog key: `monument|16.3986|107.588|Tomb of Khai Dinh`. Status: **approved for SQL publication**.

**English lesson**

Khải Định’s tomb stands on a hillside near Huế. Dark stone steps lead past statues outside. Inside, ceramic and coloured-glass mosaics decorate the walls.

Construction lasted from 1920 to 1931. The tomb combines Vietnamese and European design influences.

**Bài học tiếng Việt**

Lăng Khải Định nằm trên sườn đồi gần Huế. Bậc đá sẫm màu đi qua các tượng bên ngoài. Bên trong, tranh ghép bằng sành sứ và thủy tinh màu trang trí tường.

Công trình được xây từ năm 1920 đến năm 1931. Lăng kết hợp ảnh hưởng thiết kế Việt Nam và châu Âu.

**Flashcards / Thẻ ôn tập**

1. **EN:** Which materials form the interior mosaics at Khải Định’s tomb? → **Ceramic pieces and coloured glass.**
   **VI:** Tranh ghép bên trong lăng Khải Định dùng những vật liệu nào? → **Mảnh sành sứ và thủy tinh màu.**

2. **EN:** Between which years was Khải Định’s tomb built? → **1920 and 1931.**
   **VI:** Lăng Khải Định được xây từ năm nào đến năm nào? → **Từ năm 1920 đến năm 1931.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Which setting describes Khải Định’s tomb?

- A. An island in the Mekong Delta
- B. A hillside near Huế
- C. A cave southwest of Hanoi

**Answer: B — A hillside near Huế**

**Q1 (VI):** Địa thế nào mô tả lăng Khải Định?

- A. Đảo ở Đồng bằng sông Cửu Long
- B. Sườn đồi gần Huế
- C. Hang phía tây nam Hà Nội

**Đáp án: B — Sườn đồi gần Huế**

**Q2 (EN):** Which design influences meet at Khải Định’s tomb?

- A. Vietnamese and Inca
- B. Vietnamese and Polynesian
- C. Vietnamese and European

**Answer: C — Vietnamese and European**

**Q2 (VI):** Lăng Khải Định kết hợp ảnh hưởng thiết kế nào?

- A. Việt Nam và Inca
- B. Việt Nam và Polynesia
- C. Việt Nam và châu Âu

**Đáp án: C — Việt Nam và châu Âu**

Sources: [Vietnam National Authority of Tourism](https://vietnam.travel/node/604), [Vietnam National Authority of Tourism — Khải Định tomb chronology](https://vietnamtourism.vn/en/index.php/tourism/items/462).

**Publication note:** Use 1920–1931 for construction and distinguish mosaic materials from the dark exterior stone.

<a id="item-20"></a>
## 20. Ngọ Môn / Ngọ Môn

Catalog key: `monument|16.468|107.576|Ngọ Môn`. Status: **approved for SQL publication**.

**English lesson**

Ngọ Môn is the main entrance to Huế’s Imperial City. The Ngũ Phụng pavilion stands above the gateway. Historically, the central passage was reserved for the emperor.

The gate was built in 1833 under Emperor Minh Mạng, during a reorganisation of the Imperial City.

**Bài học tiếng Việt**

Ngọ Môn là lối vào chính của Hoàng thành Huế. Lầu Ngũ Phụng nằm phía trên phần cổng. Trước đây, lối giữa dành riêng cho nhà vua.

Cổng được xây năm 1833 dưới triều vua Minh Mạng, khi triều đình quy hoạch lại Hoàng thành.

**Flashcards / Thẻ ôn tập**

1. **EN:** What is Ngọ Môn’s role in Huế’s Imperial City? → **It is the main entrance.**
   **VI:** Ngọ Môn có vai trò gì trong Hoàng thành Huế? → **Lối vào chính.**

2. **EN:** Under which emperor was Ngọ Môn built in 1833? → **Minh Mạng.**
   **VI:** Ngọ Môn được xây năm 1833 dưới triều vua nào? → **Minh Mạng.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Who historically used Ngọ Môn’s reserved central passage?

- A. Court musicians
- B. Visiting merchants
- C. The emperor

**Answer: C — The emperor**

**Q1 (VI):** Trước đây, lối giữa dành riêng tại Ngọ Môn được dùng cho ai?

- A. Nhạc công cung đình
- B. Thương nhân đến thăm
- C. Nhà vua

**Đáp án: C — Nhà vua**

**Q2 (EN):** Which pavilion stands above Ngọ Môn’s gateway?

- A. Ngũ Phụng
- B. Minh Lâu
- C. Hiển Lâm Các

**Answer: A — Ngũ Phụng**

**Q2 (VI):** Lầu nào nằm phía trên phần cổng Ngọ Môn?

- A. Ngũ Phụng
- B. Minh Lâu
- C. Hiển Lâm Các

**Đáp án: A — Ngũ Phụng**

Sources: [Permanent Delegation of Japan to UNESCO](https://www.unesco.emb-japan.go.jp/htm/hue.htm), [Huế municipal government — Ngọ Môn architecture](https://hue.gov.vn/Du-dia-chi/tb/Ngo-Mon-546198), [Huế government — Ngọ Môn passages and Ngũ Phụng pavilion](https://phongthai.hue.gov.vn/Du-khach/Thong-tin-du-khach/Thong-tin-can-biet/tb/Ngo-Mon-546198).

**Publication note:** “Reserved for the emperor” describes historical passage rules, not present-day visitor permissions.

<a id="item-21"></a>
## 21. Imperial City of Hue / Hoàng thành Huế

Catalog key: `monument|16.469444|107.577778|Imperial City of Hue`. Status: **approved for SQL publication**.

**English lesson**

Huế’s Imperial City was the royal precinct inside the larger capital citadel. The Forbidden Purple City lay within it. Palaces, temples and courtyards served the Nguyễn court’s ceremonies and administration.

Huế was the Nguyễn dynasty’s capital from 1802 to 1945. The Imperial City forms part of the Complex of Hué Monuments, inscribed on UNESCO’s World Heritage List in 1993.

**Bài học tiếng Việt**

Hoàng thành Huế là khu vực cung đình bên trong Kinh thành rộng lớn hơn. Tử Cấm Thành nằm trong Hoàng thành. Cung điện, đền miếu và sân phục vụ nghi lễ cùng việc triều chính của nhà Nguyễn.

Huế là kinh đô triều Nguyễn từ năm 1802 đến năm 1945. Hoàng thành thuộc Quần thể di tích Cố đô Huế, được UNESCO ghi danh Di sản Thế giới năm 1993.

**Flashcards / Thẻ ôn tập**

1. **EN:** During which years was Huế the Nguyễn dynasty’s capital? → **1802 to 1945.**
   **VI:** Huế là kinh đô triều Nguyễn từ năm nào đến năm nào? → **Từ năm 1802 đến năm 1945.**

2. **EN:** What work took place in Huế’s Imperial City? → **Royal ceremonies and the Nguyễn court’s administration.**
   **VI:** Hoàng thành Huế phục vụ những công việc nào? → **Nghi lễ hoàng gia và việc triều chính của nhà Nguyễn.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Which order goes from the outermost to the innermost royal precinct?

- A. Capital citadel → Imperial City → Forbidden Purple City
- B. Imperial City → Forbidden Purple City → capital citadel
- C. Forbidden Purple City → capital citadel → Imperial City

**Answer: A — Capital citadel → Imperial City → Forbidden Purple City**

**Q1 (VI):** Thứ tự nào đi từ vòng ngoài vào vòng trong của kinh đô Huế?

- A. Kinh thành → Hoàng thành → Tử Cấm Thành
- B. Hoàng thành → Tử Cấm Thành → Kinh thành
- C. Tử Cấm Thành → Kinh thành → Hoàng thành

**Đáp án: A — Kinh thành → Hoàng thành → Tử Cấm Thành**

**Q2 (EN):** When was the Complex of Hué Monuments inscribed on UNESCO’s World Heritage List?

- A. 1802
- B. 1993
- C. 1945

**Answer: B — 1993**

**Q2 (VI):** Quần thể di tích Cố đô Huế được UNESCO ghi danh Di sản Thế giới năm nào?

- A. 1802
- B. 1993
- C. 1945

**Đáp án: B — 1993**

Sources: [UNESCO World Heritage Centre](https://whc.unesco.org/en/list/678/), [Vietnam National Authority of Tourism — nested royal precincts](https://vietnamtourism.vn/disan/en/index.php?catid=1).

**Publication note:** Preserve the nesting of Kinh thành, Hoàng thành and Tử Cấm Thành; 1993 is the monument complex’s UNESCO inscription year.

<a id="item-22"></a>
## 22. Perfume Pagoda / Chùa Hương

Catalog key: `monument|20.618333|105.7475|Perfume Pagoda`. Status: **approved for SQL publication**.

**English lesson**

Chùa Hương is a group of Buddhist temples, shrines and caves in the limestone mountains southwest of Hanoi. Hương Tích Cave contains the complex’s principal cave shrine.

During the spring pilgrimage season, visitors travel by boat along Yến Stream before continuing toward the temples and cave.

**Bài học tiếng Việt**

Chùa Hương là quần thể chùa, đền và hang động Phật giáo trong vùng núi đá vôi phía tây nam Hà Nội. Động Hương Tích có ngôi chùa trong hang quan trọng nhất của quần thể.

Vào mùa hành hương đầu xuân, khách đi thuyền dọc suối Yến rồi tiếp tục đến các chùa và hang.

**Flashcards / Thẻ ôn tập**

1. **EN:** Which stream carries boats toward Chùa Hương? → **Yến Stream.**
   **VI:** Thuyền đưa khách về phía Chùa Hương đi dọc suối nào? → **Suối Yến.**

2. **EN:** Which cave contains Chùa Hương’s principal cave shrine? → **Hương Tích Cave.**
   **VI:** Ngôi chùa trong hang quan trọng nhất của Chùa Hương nằm ở động nào? → **Động Hương Tích.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Which description correctly describes Chùa Hương?

- A. A single tower in central Hanoi
- B. A complex of temples, shrines and caves
- C. One royal tomb beside the Perfume River

**Answer: B — A complex of temples, shrines and caves**

**Q1 (VI):** Mô tả nào đúng về Chùa Hương?

- A. Một ngọn tháp đơn lẻ ở trung tâm Hà Nội
- B. Quần thể chùa, đền và hang động
- C. Một lăng vua bên sông Hương

**Đáp án: B — Quần thể chùa, đền và hang động**

**Q2 (EN):** When does Chùa Hương’s main pilgrimage season take place?

- A. Summer
- B. Autumn
- C. Spring

**Answer: C — Spring**

**Q2 (VI):** Mùa hành hương chính ở Chùa Hương diễn ra vào mùa nào?

- A. Mùa hè
- B. Mùa thu
- C. Mùa xuân

**Đáp án: C — Mùa xuân**

Sources: [Vietnam Airlines destination guide](https://www.vietnamairlines.com/sa/en/plan-book/travel/travel-guide/perfume-pagoda), [Vietnam National Authority of Tourism — Chùa Hương pilgrimage](https://vietnam.travel/node/273).

**Publication note:** Chùa Hương is a complex; Hương Tích is its principal cave shrine and Yến is the boat route.

<a id="item-23"></a>
## 23. El Niño / El Niño

Catalog key: `phenomenon|-12.0464|-77.0428|El Niño`. Status: **approved for SQL publication**.

**English lesson**

During El Niño, the surface of the central and eastern tropical Pacific is unusually warm. Weakening trade winds allow warm surface water to spread eastward.

El Niño is the warm phase of ENSO, the El Niño–Southern Oscillation. Changes in ocean heat and air circulation can alter rainfall and weather far beyond the Pacific.

**Bài học tiếng Việt**

Trong El Niño, nước mặt ở vùng nhiệt đới trung tâm và phía đông Thái Bình Dương ấm bất thường. Gió tín phong yếu đi cho phép nước ấm trên mặt biển lan về phía đông.

El Niño là pha nóng của ENSO, tức El Niño–Dao động phương Nam. Thay đổi nhiệt đại dương và hoàn lưu không khí có thể làm đổi mưa cùng thời tiết ở nhiều nơi xa Thái Bình Dương.

**Flashcards / Thẻ ôn tập**

1. **EN:** Is El Niño the whole ENSO climate pattern or one phase of it? → **It is the warm phase of ENSO, not the whole pattern.**
   **VI:** El Niño là toàn bộ kiểu biến động khí hậu ENSO hay một pha của nó? → **El Niño là pha nóng của ENSO, không phải toàn bộ kiểu biến động.**

2. **EN:** Which ocean’s tropical surface waters warm during El Niño? → **The Pacific Ocean.**
   **VI:** Nước mặt vùng nhiệt đới của đại dương nào ấm lên trong El Niño? → **Thái Bình Dương.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** What happens when Pacific trade winds weaken during El Niño?

- A. Warm surface water is pushed farther west
- B. Cold deep water rises more strongly in the east
- C. Warm surface water spreads eastward

**Answer: C — Warm surface water spreads eastward**

**Q1 (VI):** Điều gì xảy ra khi gió tín phong Thái Bình Dương yếu đi trong El Niño?

- A. Nước ấm trên mặt biển bị đẩy xa hơn về phía tây
- B. Nước lạnh dưới sâu trồi lên mạnh hơn ở phía đông
- C. Nước ấm trên mặt biển lan về phía đông

**Đáp án: C — Nước ấm trên mặt biển lan về phía đông**

**Q2 (EN):** How can El Niño affect places far from the tropical Pacific?

- A. By shifting rainfall and weather patterns
- B. By changing which ocean basin has tides
- C. By moving continents closer together

**Answer: A — By shifting rainfall and weather patterns**

**Q2 (VI):** El Niño có thể ảnh hưởng nơi xa vùng nhiệt đới Thái Bình Dương bằng cách nào?

- A. Làm dịch chuyển mưa và các kiểu thời tiết
- B. Làm thay đổi đại dương nào có thủy triều
- C. Đưa các lục địa lại gần nhau

**Đáp án: A — Làm dịch chuyển mưa và các kiểu thời tiết**

Sources: [NOAA](https://www.noaa.gov/understanding-el-nino), [NOAA Ocean Service — El Niño and trade winds](https://oceanservice.noaa.gov/facts/ninonina.html).

**Publication note:** Replace the Vietnamese title “Dao động phương Nam” with “El Niño”. Remove the unsupported 1600 start year rather than treating it as the phenomenon’s beginning.

<a id="item-24"></a>
## 24. Hailstorm / Mưa đá

Catalog key: `phenomenon|-34.6037|-58.3816|Hailstorm`. Status: **approved for SQL publication**.

**English lesson**

A hailstorm drops lumps of ice called hailstones. Inside a thunderstorm, rising air can hold ice high in the cold cloud, where supercooled water droplets freeze onto it and make it grow.

When a hailstone becomes too heavy for the rising air to support, it falls. This explains why ice can reach the ground even during a storm on a warm day.

**Bài học tiếng Việt**

Mưa đá làm rơi xuống những cục băng gọi là hạt mưa đá. Trong mây dông, luồng khí đi lên có thể giữ băng ở vùng lạnh trên cao. Những giọt nước siêu lạnh đóng băng lên bề mặt, khiến hạt lớn dần.

Khi hạt mưa đá quá nặng để luồng khí nâng đỡ, nó rơi xuống. Vì vậy, băng vẫn có thể chạm đất trong một cơn dông vào ngày trời ấm.

**Flashcards / Thẻ ôn tập**

1. **EN:** What are hailstones made of? → **Ice.**
   **VI:** Hạt mưa đá được tạo từ chất gì? → **Băng.**

2. **EN:** What holds growing hailstones high inside a thunderstorm? → **Rising air called an updraft.**
   **VI:** Điều gì giữ hạt mưa đá đang lớn ở trên cao trong mây dông? → **Luồng không khí đi lên.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** How does a hailstone grow inside a cold thunderstorm cloud?

- A. Supercooled droplets freeze onto it
- B. Snowflakes melt completely into liquid drops
- C. Water evaporates from its surface

**Answer: A — Supercooled droplets freeze onto it**

**Q1 (VI):** Hạt mưa đá lớn lên trong mây dông lạnh bằng cách nào?

- A. Giọt nước siêu lạnh đóng băng lên bề mặt
- B. Bông tuyết tan hoàn toàn thành giọt lỏng
- C. Nước bay hơi khỏi bề mặt

**Đáp án: A — Giọt nước siêu lạnh đóng băng lên bề mặt**

**Q2 (EN):** When does a hailstone fall from the cloud?

- A. When rising air becomes strong enough to lift it higher
- B. When rising air can no longer support its weight
- C. When it melts completely into rain

**Answer: B — When rising air can no longer support its weight**

**Q2 (VI):** Khi nào hạt mưa đá rơi khỏi mây?

- A. Khi luồng khí mạnh đủ để nâng nó cao hơn
- B. Khi luồng khí đi lên không còn đỡ nổi trọng lượng của nó
- C. Khi nó tan hoàn toàn thành mưa

**Đáp án: B — Khi luồng khí đi lên không còn đỡ nổi trọng lượng của nó**

Sources: [NOAA](https://www.noaa.gov/jetstream/hail).

**Publication note:** Do not confuse hail with raindrops freezing only after reaching the ground.

<a id="item-25"></a>
## 25. Hurricane / Bão nhiệt đới — hurricane

Catalog key: `phenomenon|29.9511|-90.0715|Hurricane`. Status: **approved for SQL publication**.

**English lesson**

A hurricane is a powerful tropical cyclone. Bands of rain curve around its centre. In a well-developed storm, a relatively calm eye is surrounded by an eyewall with intense rain and very strong winds.

The calm inside the eye does not mean the storm has ended. As the cyclone moves, the other side of the eyewall can bring dangerous conditions again.

**Bài học tiếng Việt**

Hurricane là tên gọi một loại xoáy thuận nhiệt đới mạnh. Các dải mưa cuộn quanh tâm bão. Khi bão phát triển rõ, mắt bão tương đối yên được bao quanh bởi thành mắt bão có mưa dữ dội và gió rất mạnh.

Sự yên lặng trong mắt bão không có nghĩa là bão đã qua. Khi bão di chuyển, phía bên kia thành mắt bão có thể lại mang đến thời tiết nguy hiểm.

**Flashcards / Thẻ ôn tập**

1. **EN:** Which part of a well-developed hurricane can be relatively calm? → **The eye.**
   **VI:** Phần nào của một cơn bão phát triển rõ có thể tương đối yên? → **Mắt bão.**

2. **EN:** How are a hurricane’s rainbands arranged? → **They curve around the storm’s centre.**
   **VI:** Các dải mưa của hurricane được sắp xếp thế nào? → **Cuộn quanh tâm bão.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Where are very strong winds and intense rain found around a hurricane’s eye?

- A. In the calm centre of the eye
- B. In the eyewall
- C. Only outside the outermost rainbands

**Answer: B — In the eyewall**

**Q1 (VI):** Gió rất mạnh và mưa dữ dội tập trung ở đâu quanh mắt bão?

- A. Ở tâm yên lặng của mắt bão
- B. Trong thành mắt bão
- C. Chỉ ngoài dải mưa xa nhất

**Đáp án: B — Trong thành mắt bão**

**Q2 (EN):** Why can dangerous winds return after a hurricane’s calm eye passes?

- A. The original storm has ended and a new one has formed
- B. The eye is the start of the storm’s outer rainbands
- C. The other side of the eyewall moves over the area

**Answer: C — The other side of the eyewall moves over the area**

**Q2 (VI):** Vì sao gió nguy hiểm có thể trở lại sau khi mắt bão yên lặng đi qua?

- A. Cơn bão ban đầu đã hết và bão mới hình thành
- B. Mắt bão là điểm bắt đầu dải mưa ngoài rìa
- C. Phía bên kia thành mắt bão di chuyển qua khu vực

**Đáp án: C — Phía bên kia thành mắt bão di chuyển qua khu vực**

Sources: [NOAA](https://www.noaa.gov/jetstream/tropical/tropical-cyclone-introduction/tropical-cyclone-structure).

**Publication note:** Keep the eye distinct from the eyewall; the end of the calm eye does not mean the end of the storm.

<a id="item-26"></a>
## 26. Tsunami / Sóng thần

Catalog key: `phenomenon|35.6762|139.6503|Tsunami`. Status: **approved for SQL publication**.

**English lesson**

A tsunami is a series of long waves caused by a large, sudden movement of water. An undersea earthquake can move the seafloor and push the water above it, sending waves across the ocean.

Tsunamis behave differently from ordinary wind-driven waves. They may be hard to notice in deep water but grow much higher near shore. The first wave is not always the largest.

**Bài học tiếng Việt**

Sóng thần là một chuỗi sóng dài do một lượng nước lớn dịch chuyển đột ngột. Động đất dưới biển có thể làm đáy biển chuyển động và đẩy khối nước phía trên, tạo sóng lan qua đại dương.

Sóng thần khác sóng thông thường do gió tạo ra. Ngoài biển sâu, sóng có thể khó nhận thấy nhưng cao lên nhiều khi đến gần bờ. Đợt sóng đầu tiên không phải lúc nào cũng lớn nhất.

**Flashcards / Thẻ ôn tập**

1. **EN:** Is a tsunami one wave or a series of waves? → **A series of long waves.**
   **VI:** Sóng thần là một đợt sóng đơn lẻ hay một chuỗi sóng? → **Một chuỗi sóng dài.**

2. **EN:** How can an undersea earthquake start a tsunami? → **It moves the seafloor and displaces the water above it.**
   **VI:** Động đất dưới biển có thể khởi phát sóng thần bằng cách nào? → **Làm đáy biển chuyển động và đẩy khối nước phía trên.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** What can happen as tsunami waves enter shallow water near shore?

- A. They keep the same small height as in deep water
- B. They become ordinary waves driven only by local wind
- C. They grow much higher

**Answer: C — They grow much higher**

**Q1 (VI):** Điều gì có thể xảy ra khi sóng thần vào vùng nước nông gần bờ?

- A. Sóng giữ nguyên độ cao nhỏ như ngoài biển sâu
- B. Sóng trở thành sóng thường chỉ do gió tại chỗ
- C. Sóng cao lên nhiều

**Đáp án: C — Sóng cao lên nhiều**

**Q2 (EN):** Which statement about the first tsunami wave is correct?

- A. Later waves can be larger
- B. The first wave must be the largest
- C. The first wave is the entire tsunami

**Answer: A — Later waves can be larger**

**Q2 (VI):** Nhận xét nào đúng về đợt sóng thần đầu tiên?

- A. Các đợt sau có thể lớn hơn
- B. Đợt đầu nhất định lớn nhất
- C. Đợt đầu là toàn bộ sóng thần

**Đáp án: A — Các đợt sau có thể lớn hơn**

Sources: [NOAA](https://www.noaa.gov/jetstream/tsunamis), [NOAA Ocean Service — tsunami formation](https://oceanservice.noaa.gov/facts/tsunami.html).

**Publication note:** Replace any question treating a tsunami as a single wave or the first wave as necessarily largest.

<a id="item-27"></a>
## 27. Waterspout / Vòi rồng trên mặt nước

Catalog key: `phenomenon|37.5999|14.0153|Waterspout`. Status: **approved for SQL publication**.

**English lesson**

A waterspout is a rotating column of air over water, often visible as a funnel below a cloud. It can lift spray from the surface, but the funnel is not simply a tube of seawater.

Tornadic waterspouts develop downward from tornado-producing thunderstorms. Fair-weather waterspouts develop upward from the water surface beneath growing clouds.

**Bài học tiếng Việt**

Vòi rồng trên mặt nước là cột không khí xoay phía trên biển hoặc hồ, thường hiện thành phễu dưới mây. Nó có thể cuốn bụi nước lên, nhưng phễu không đơn giản là một ống nước biển.

Vòi rồng kiểu lốc xoáy phát triển từ mây dông tạo lốc đi xuống. Loại thường gọi là vòi rồng thời tiết đẹp phát triển từ mặt nước đi lên dưới các đám mây đang lớn.

**Flashcards / Thẻ ôn tập**

1. **EN:** What is rotating in a waterspout? → **A column of air over water.**
   **VI:** Thứ gì xoay trong vòi rồng trên mặt nước? → **Một cột không khí phía trên mặt nước.**

2. **EN:** Where is a waterspout’s visible funnel usually seen? → **Below a cloud, extending toward the water.**
   **VI:** Phễu vòi rồng trên mặt nước thường được nhìn thấy ở đâu? → **Dưới đám mây, vươn về phía mặt nước.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** How does a fair-weather waterspout begin developing?

- A. From the water surface upward
- B. From a rotating thunderstorm downward
- C. From sea spray drifting sideways without rotation

**Answer: A — From the water surface upward**

**Q1 (VI):** Vòi rồng thời tiết đẹp bắt đầu phát triển như thế nào?

- A. Từ mặt nước đi lên
- B. Từ mây dông xoáy đi xuống
- C. Từ bụi nước trôi ngang mà không xoay

**Đáp án: A — Từ mặt nước đi lên**

**Q2 (EN):** Which weather system is associated with a tornadic waterspout?

- A. A non-rotating sheet of sea fog
- B. A tornado-producing thunderstorm
- C. A winter snowstorm with no convective clouds

**Answer: B — A tornado-producing thunderstorm**

**Q2 (VI):** Vòi rồng kiểu lốc xoáy gắn với hệ thống thời tiết nào?

- A. Lớp sương mù biển không xoay
- B. Mây dông tạo lốc xoáy
- C. Bão tuyết mùa đông không có mây đối lưu

**Đáp án: B — Mây dông tạo lốc xoáy**

Sources: [US National Weather Service](https://www.weather.gov/mfl/waterspouts).

**Publication note:** “Fair-weather” is a type name, not a claim that a waterspout is harmless. Teach the two formation directions explicitly.

<a id="item-28"></a>
## 28. Black ice / Băng mỏng trong suốt

Catalog key: `phenomenon|28.6139|77.209|Black ice`. Status: **approved for SQL publication**.

**English lesson**

Black ice is a thin, hard-to-see layer of ice on a road or other surface. The ice is usually clear, so the dark pavement beneath it can make the surface look merely wet.

Rainwater or melted snow can refreeze when a road cools below freezing. Freezing fog can also leave ice. Bridges and overpasses can freeze before other road surfaces.

**Bài học tiếng Việt**

Black ice là lớp băng mỏng rất khó thấy trên đường hoặc bề mặt khác. Băng thường trong suốt, nên mặt đường sẫm màu bên dưới có thể khiến người nhìn tưởng đường chỉ bị ướt.

Nước mưa hoặc tuyết tan có thể đóng băng lại khi mặt đường lạnh xuống dưới điểm đóng băng. Sương mù đóng băng cũng có thể để lại băng. Cầu và cầu vượt có thể đóng băng trước các mặt đường khác.

**Flashcards / Thẻ ôn tập**

1. **EN:** Why can black ice look like wet, dark pavement? → **The ice is clear, allowing the dark road underneath to show through.**
   **VI:** Vì sao black ice có thể trông như mặt đường sẫm màu bị ướt? → **Băng trong suốt nên nhìn xuyên thấy mặt đường sẫm màu bên dưới.**

2. **EN:** What can happen to rainwater on a road when its surface drops below freezing? → **The water can freeze into a hard-to-see ice layer.**
   **VI:** Điều gì có thể xảy ra với nước mưa trên đường khi bề mặt lạnh xuống dưới điểm đóng băng? → **Nước có thể đóng thành lớp băng khó thấy.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** Which condition can also leave black ice on a road?

- A. Fog in above-freezing air over a warm road
- B. Freezing fog
- C. Dry frost-free air over a warm road

**Answer: B — Freezing fog**

**Q1 (VI):** Điều kiện nào cũng có thể để lại black ice trên đường?

- A. Sương mù trong không khí trên điểm đóng băng và đường ấm
- B. Sương mù đóng băng
- C. Không khí khô không có sương giá trên đường ấm

**Đáp án: B — Sương mù đóng băng**

**Q2 (EN):** Which surfaces can freeze before ordinary road surfaces?

- A. Roads inside heated tunnels
- B. Sun-warmed roads that remain above freezing
- C. Bridges and overpasses

**Answer: C — Bridges and overpasses**

**Q2 (VI):** Bề mặt nào có thể đóng băng trước mặt đường thông thường?

- A. Đường trong hầm được sưởi
- B. Đường ấm do nắng và vẫn trên điểm đóng băng
- C. Cầu và cầu vượt

**Đáp án: C — Cầu và cầu vượt**

Sources: [US National Weather Service](https://www.weather.gov/safety/winter-ice-frost), [US National Weather Service — freezing fog](https://www.weather.gov/safety/fog-freezing).

**Publication note:** Use clear ice over dark pavement, not black-coloured frozen water.

<a id="item-29"></a>
## 29. Airglow / Ánh sáng khí quyển

Catalog key: `phenomenon|35.6762|139.6503|Airglow`. Status: **approved for SQL publication**.

**English lesson**

Airglow is faint light made by gases high in Earth’s atmosphere. Sunlight supplies energy to these gases, and processes involving their atoms and molecules release some of that energy as visible light.

Different gases and altitude layers produce different airglow colours, which scientists use to study the upper atmosphere. Airglow occurs across the globe and is often too faint for the eye to notice.

**Bài học tiếng Việt**

Ánh sáng khí quyển là ánh sáng mờ do khí ở tầng cao của khí quyển Trái Đất tạo ra. Ánh nắng cung cấp năng lượng; các quá trình liên quan đến nguyên tử và phân tử giải phóng một phần năng lượng ấy thành ánh sáng nhìn thấy được.

Các loại khí và lớp độ cao khác nhau tạo màu ánh sáng khí quyển khác nhau, giúp các nhà khoa học nghiên cứu khí quyển trên cao. Hiện tượng xuất hiện khắp thế giới và thường quá mờ để mắt nhận thấy.

**Flashcards / Thẻ ôn tập**

1. **EN:** What supplies much of the energy behind airglow? → **Sunlight.**
   **VI:** Điều gì cung cấp phần lớn năng lượng tạo ánh sáng khí quyển? → **Ánh nắng Mặt Trời.**

2. **EN:** Where are the gases that produce airglow? → **High in Earth’s atmosphere.**
   **VI:** Những khí tạo ánh sáng khí quyển nằm ở đâu? → **Trên cao trong khí quyển Trái Đất.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** What can scientists investigate using different airglow colours?

- A. The depth of water under the observer
- B. The age of rocks beneath the observer
- C. Different gases and altitude layers

**Answer: C — Different gases and altitude layers**

**Q1 (VI):** Các nhà khoa học dùng màu ánh sáng khí quyển để tìm hiểu điều gì?

- A. Độ sâu nước dưới người quan sát
- B. Tuổi đá dưới người quan sát
- C. Các loại khí và lớp độ cao khác nhau

**Đáp án: C — Các loại khí và lớp độ cao khác nhau**

**Q2 (EN):** Where can airglow occur?

- A. Across the globe
- B. Only near the North Pole
- C. Only near the South Pole

**Answer: A — Across the globe**

**Q2 (VI):** Ánh sáng khí quyển có thể xuất hiện ở đâu?

- A. Khắp thế giới
- B. Chỉ gần Bắc Cực
- C. Chỉ gần Nam Cực

**Đáp án: A — Khắp thế giới**

Sources: [NASA](https://www.nasa.gov/solar-system/why-nasa-watches-airglow-the-colors-of-the-upper-atmospheric-wind/), [NASA — aurora and airglow comparison](https://mynasadata.larc.nasa.gov/mini-lessonactivity/aurora-vs-airglow).

**Publication note:** Keep airglow distinct from auroras and from reflected light on clouds.

<a id="item-30"></a>
## 30. Atmospheric refraction / Khúc xạ khí quyển

Catalog key: `phenomenon|40.7128|-74.006|Atmospheric refraction`. Status: **approved for SQL publication**.

**English lesson**

Atmospheric refraction happens when light bends as it travels through air of different densities. Temperature differences can create layers that make distant objects appear shifted, stretched or upside down.

Over a hot road, refraction can make light from the sky look like a patch of water on dry ground. Near the horizon, atmospheric refraction also makes the Sun appear higher than its true geometric position.

**Bài học tiếng Việt**

Khúc xạ khí quyển xảy ra khi ánh sáng đổi hướng lúc đi qua các lớp không khí có mật độ khác nhau. Chênh lệch nhiệt độ có thể tạo các lớp khiến vật ở xa trông lệch vị trí, kéo dài hoặc lộn ngược.

Trên đường nóng, khúc xạ có thể khiến ánh sáng từ bầu trời trông như vũng nước trên nền đường khô. Gần chân trời, khúc xạ khí quyển còn khiến Mặt Trời trông cao hơn vị trí hình học thực.

**Flashcards / Thẻ ôn tập**

1. **EN:** What happens to light passing through air layers of different densities? → **Its path can bend: this is atmospheric refraction.**
   **VI:** Điều gì xảy ra với ánh sáng đi qua các lớp không khí có mật độ khác nhau? → **Đường đi có thể đổi hướng: đó là khúc xạ khí quyển.**

2. **EN:** How can temperature layers in the air change a distant object’s appearance? → **It may look shifted, stretched or upside down.**
   **VI:** Các lớp nhiệt độ trong không khí có thể làm vật ở xa trông khác đi thế nào? → **Vật có thể trông lệch vị trí, kéo dài hoặc lộn ngược.**

**Quiz / Câu hỏi trắc nghiệm**

**Q1 (EN):** What can a water-like patch seen on a hot, dry road be?

- A. Refracted light from the sky
- B. Reflected sunlight from a real puddle
- C. A shadow from a passing cloud

**Answer: A — Refracted light from the sky**

**Q1 (VI):** Vệt giống vũng nước trên đường nóng và khô có thể là gì?

- A. Ánh sáng bầu trời bị khúc xạ
- B. Ánh nắng phản chiếu từ vũng nước thật
- C. Bóng của đám mây đi qua

**Đáp án: A — Ánh sáng bầu trời bị khúc xạ**

**Q2 (EN):** How does atmospheric refraction affect the Sun seen near the horizon?

- A. It appears lower than its true geometric position
- B. It appears higher than its true geometric position
- C. It stays at its true position and only changes colour

**Answer: B — It appears higher than its true geometric position**

**Q2 (VI):** Khúc xạ khí quyển ảnh hưởng thế nào đến Mặt Trời gần chân trời?

- A. Mặt Trời trông thấp hơn vị trí hình học thực
- B. Mặt Trời trông cao hơn vị trí hình học thực
- C. Mặt Trời giữ đúng vị trí thực và chỉ đổi màu

**Đáp án: B — Mặt Trời trông cao hơn vị trí hình học thực**

Sources: [Wikipedia — Atmospheric refraction](https://en.wikipedia.org/wiki/Atmospheric_refraction), [Wikipedia — Mirage](https://en.wikipedia.org/wiki/Mirage), [World Meteorological Organization — mirages](https://cloudatlas.wmo.int/en/mirage.html), [NASA — refraction and the apparent position of the Sun](https://science.nasa.gov/learn/basics-of-space-flight/chapter6-6/).

**Publication note:** A hot-road mirage is refracted sky light; do not describe it as actual water or a hallucination.
