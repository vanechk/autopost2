/**
 * City configuration for KudaGo API
 */
export const CITIES = {
    msk: { name: 'Москва', afishaCityName: 'Москве', emoji: '🏙️', slug: 'msk', yandexAfishaUrl: 'https://afisha.yandex.ru/moscow' },
    spb: { name: 'Санкт-Петербург', afishaCityName: 'Санкт-Петербурге', emoji: '🎭', slug: 'spb', yandexAfishaUrl: 'https://afisha.yandex.ru/saint-petersburg' },
    smr: { name: 'Самара', afishaCityName: 'Самаре', emoji: '🌊', slug: 'smr', yandexAfishaUrl: 'https://afisha.yandex.ru/samara' },
    sim: { name: 'Симферополь', afishaCityName: 'Симферополе', emoji: '🏔️', slug: 'sim', yandexAfishaUrl: 'https://afisha.yandex.ru/simferopol' }
};

/**
 * Public Yandex Afisha entry point. It is used as a click-through link:
 * direct server requests are regularly blocked by Yandex SmartCaptcha.
 */
export const YANDEX_AFISHA = {
    baseUrl: 'https://afisha.yandex.ru'
};

/**
 * KudaGo API configuration
 */
export const KUDAGO = {
    baseUrl: 'http://kudago.com/public-api/v1.4',
    categories: 'exhibition,concert,theater,festival,party,quest,education',
    pageSize: 20,
    fields: 'id,title,description,short_title,dates,price,place,site_url,images,age_restriction,categories'
};

/**
 * Russian public holidays (month-day format, repeats yearly unless year-specific)
 * Source: https://www.consultant.ru/law/ref/calendar/proizvodstvennye/
 */
export const HOLIDAYS = [
    // Новогодние каникулы + Рождество
    '01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07', '01-08',
    // День защитника Отечества
    '02-23',
    // Международный женский день
    '03-08',
    // Праздник Весны и Труда
    '05-01',
    // День Победы
    '05-09',
    // День России
    '06-12',
    // День народного единства
    '11-04'
];

/**
 * Event filtering configuration
 */
export const FILTERS = {
    // "тур" is deliberately NOT a keyword: Afisha describes every headline
    // concert as «Тур „Шоумен“», so it silently removed artists on tour.
    excludeKeywords: ['стриптиз', 'casino', '18+', 'night club', 'afterparty', 'эротик', 'казино'],
    // Travel tours (bus, walking, gastro) are still out.
    excludeTravelTour: /(?:автобусн|экскурсионн|пешеходн|гастрономическ|винн|туристическ)\S*\s+(?:тур|tour)|(?:^|[^\p{L}])тур\s+(?:по|выходного дня)/iu,
    // The old ceiling removed most large concerts and shows before ranking.
    maxPrice: 8000,
    // Candidates handed to curation per city (the post shows three).
    maxEvents: 40
};

/**
 * Weekly post curation (see src/curation.js). The post goes to a team of
 * colleagues: calm, broadly liked, and different every week.
 */
export const CURATION = {
    // Do not repeat a listing that ran in this city within N weeks.
    repeatWindowWeeks: 6,
    // Below this an event only fills a card that would otherwise be short.
    minScore: 25,

    // Afisha genre tags that never go into the team post.
    blockedTags: ['chanson', 'spiritual_music', 'karaoke'],
    blockedKeywords: ['шансон', 'блатн', 'тюремн', 'лагерн', 'воровск', 'бутырк', 'лесоповал'],
    // Provocative, explicit or politically loaded acts. Whole-word match on
    // the listing title, so "Ленинград" does not hit "Ленинградская симфония".
    blockedArtists: [
        'Воровайки', 'Бутырка', 'Лесоповал', 'Михаил Круг', 'Сектор газа', 'Ленинград',
        'Шнуров', 'Шаман', 'Shaman', 'Быдлоцыкл', 'АК-47', 'ТГК', 'Кровосток',
        'Инстасамка', 'Instasamka', 'Моргенштерн', 'Morgenshtern', 'Слава КПСС', 'Замай',
        'Порнофильмы', 'Пошлая Молли', 'Хаски', 'Big Baby Tape', 'Kizaru',
        'Ярослав Сумишевский', 'Сумишевский', 'Григорий Лепс', 'Стас Михайлов', 'Елена Ваенга',
        'Радио Тапок', 'Radio Tapok', 'Чёрный обелиск', 'Catharsis', 'Коррозия металла',
        'Монгол Шуудан', 'Северный флот'
    ],

    categoryBase: {
        concert: 40, standup: 36, show: 34, festival: 36, theater: 36, exhibition: 34, education: -20, other: 0
    },
    // Afisha tag signals of a listing people actually plan around.
    tagWeights: {
        'artist-tour': 28, 'hot': 14, 'top-persons': 10, 'yandexafisha-choice': 10, 'topshows': 8,
        'high-rated': 8, 'season-premiere': 6, 'immersive-theatre': 6, 'toptheatres': 8, 'laureate': 4,
        // Exhibitions: real museum shows over commercial "immersive" rooms.
        'tretyakovskaya-galereya': 12, 'exclusive': 8, 'photobiennale': 10, 'photography': 4,
        'painting': 4, 'architecture': 4, 'history': 3, 'luchshee-vzroslym': 4,
        'multimedia': -8, 'quest-vr': -10, 'media': -4,
        // City happenings: fairs, food and city festivals.
        'city-fest': 20, 'fair': 8, 'gastronomic': 6, 'standup-solo': 8, 'big-tickets-theatre': 4,
        // Anonymous "big stand-up night" line-ups run every weekend.
        'standup-collective': -12,
        // Loud or niche genres are allowed but should not lead a team post.
        'metal': -25, 'punk': -20, 'tehno': -15, 'house': -10, 'kids': -60, 'family-events': -30
    },
    // Generic programmes: candlelight concerts, orchestras covering other
    // people's music, film-score nights, tribute shows.
    genericTags: ['tribute', 'soundtrack', 'symphony-show', 'koncerty-imperial-orchestra', 'music-show'],
    genericTitlePattern: /при свечах|в свечах|в исполнении|оркестр|хиты|трибьют|tribute|кавер|cover|музыка (?:из|к|людовико|ханса)|вселенная|симфони[яи] |в планетарии|под куполом|погружение|величайш|легенд(?:ы|арн)|шоу (?:японских|барабанов)/i,
    notAnExhibitionPattern: /зоопарк|аквариум|океанариум|постоянн(?:ая|ой) экспозиц|^посещение|выставки и постоянная/i,
    folkEnsemblePattern: /(?:^|\s)хор(?:\s|$|а\s)|ансамбль (?:песни|танца)|песни и пляски|казач|хореографический ансамбль/i
};

/**
 * Movie recommendations for admin posts
 */
export const MOVIES = [
    { "title": "Быстрее пули", "desc": "Зрелищный боевик о наемниках в скоростном поезде.", "kinopoisk": "https://www.kinopoisk.ru/film/1392550/", "url": "https://lordfilm.ai/1287-bystree-puli-2022.html" },
    { "title": "Пурпурные сердца", "desc": "Трогательная история любви морпеха и начинающей певицы.", "kinopoisk": "https://www.kinopoisk.ru/film/4633045/", "url": "https://lordfilm.ai/3941-purpurnye-serdca.html" },
    { "title": "Ущелье", "desc": "Напряженный триллер о выживании в экстремальных условиях.", "kinopoisk": "https://www.kinopoisk.ru/film/5098653/", "url": "https://lordfilm.ai/8748-uschele.html" },
    { "title": "Планета обезьян: Новое царство", "desc": "Эпическое продолжение борьбы за господство на планете.", "kinopoisk": "https://www.kinopoisk.ru/film/1338024/", "url": "https://lordfilm.ai/3043-planeta-obezjan-novoe-carstvo.html" },
    { "title": "Формула-1", "desc": "Драма о больших скоростях и амбициях в мире автоспорта.", "kinopoisk": "https://www.kinopoisk.ru/film/5003510/", "url": "https://lordfilm.ai/9327-formula-1.html" },
    { "title": "Война будущего", "desc": "Масштабная битва человечества против пришельцев из будущего.", "kinopoisk": "https://www.kinopoisk.ru/film/1283945/", "url": "https://lordfilm.ai/1498-vojna-buduschego-2021.html" },
    { "title": "Первому игроку приготовиться", "desc": "Захватывающий квест в виртуальном мире будущего от Спилберга.", "kinopoisk": "https://www.kinopoisk.ru/film/538225/", "url": "https://lordfilm.ai/4364-pervomu-igroku-prigotovitsja.html" },
    { "title": "Как приручить дракона", "desc": "Добрая история о дружбе мальчика и самого быстрого дракона.", "kinopoisk": "https://www.kinopoisk.ru/film/5267432/", "url": "https://lordfilm.ai/9336-kak-priruchit-drakona.html" },
    { "title": "Код 3", "desc": "Напряженная драма о работе службы экстренной помощи.", "kinopoisk": "https://www.kinopoisk.ru/film/7859199/", "url": "https://lordfilm.ai/9424-kod-3.html" },
    { "title": "Под прикрытием", "desc": "Опасная операция полицейского в самом сердце преступного мира.", "kinopoisk": "https://www.kinopoisk.ru/film/7444842/", "url": "https://lordfilm.ai/9341-pod-prikrytiem.html" },
    { "title": "Час тишины", "desc": "Детективный триллер о свидетелье, потерявшем слух.", "kinopoisk": "https://www.kinopoisk.ru/film/5212153/", "url": "https://lordfilm.ai/7044-chas-tishiny.html" },
    { "title": "Девушка из каюты №10", "desc": "Запутанная детективная история на борту роскошной яхты.", "kinopoisk": "https://www.kinopoisk.ru/film/7104907/", "url": "https://lordfilm.ai/9576-devushka-iz-kajuty-10.html" },
    { "title": "Электрический штат", "desc": "Фантастическое путешествие девочки-подростка и робота по Америке.", "kinopoisk": "https://www.kinopoisk.ru/film/5024992/", "url": "https://lordfilm.ai/8780-jelektricheskij-shtat.html" },
    { "title": "Грейхаунд", "desc": "Масштабная морская баталия времен Второй мировой войны.", "kinopoisk": "https://www.kinopoisk.ru/film/1055194/", "url": "https://lordfilm.ai/2860-grejhaund.html" },
    { "title": "Соник 2 в кино", "desc": "Быстрый синий ежик возвращается, чтобы спасти мир снова.", "kinopoisk": "https://www.kinopoisk.ru/film/1387469/", "url": "https://lordfilm.ai/1902-sonik-2-v-kino-2022.html" },
    { "title": "Балерина", "desc": "История о мести и грации в мире наемных убийц.", "kinopoisk": "https://www.kinopoisk.ru/film/1047492/", "url": "https://lordfilm.ai/9326-balerina.html" },
    { "title": "Лило и Стич", "desc": "Классическая история о дружбе гавайской девочки и инопланетянина.", "kinopoisk": "https://www.kinopoisk.ru/film/1348367/", "url": "https://lordfilm.ai/9237-lilo-i-stich.html" },
    { "title": "Вонка", "desc": "Красочная история становления величайшего шоколатье в мире.", "kinopoisk": "https://www.kinopoisk.ru/film/1013343/", "url": "https://lordfilm.ai/205-wonka-2023.html" },
    { "title": "Орудия", "desc": "Мистический хоррор о загадочном исчезновении целого класса детей.", "kinopoisk": "https://www.kinopoisk.ru/film/6782779/", "url": "https://lordfilm.ai/9385-orudija.html" },
    { "title": "Миссия: Красный", "desc": "Комедийный боевик о спасении Рождества элитным спецназом.", "kinopoisk": "https://www.kinopoisk.ru/film/4745231/", "url": "https://lordfilm.ai/7049-missija-krasnyj.html" },
    { "title": "Дом у дороги", "desc": "Переосмысление классического боевика о неукротимом вышибале.", "kinopoisk": "https://www.kinopoisk.ru/film/817167/", "url": "https://lordfilm.ai/2727-dom-u-dorogi-1989.html" },
    { "title": "Клуб убийств по четвергам", "desc": "Ироничный детектив о пенсионерах, расследующих настоящие преступления.", "kinopoisk": "https://www.kinopoisk.ru/film/5422118/", "url": "https://lordfilm.ai/9451-klub-ubijstv-po-chetvergam.html" },
    { "title": "Муфаса: Король Лев", "desc": "История о том, как юный лев стал легендарным королем.", "kinopoisk": "https://www.kinopoisk.ru/film/1431102/", "url": "https://lordfilm.ai/7058-mufasa-korol-lev.html" },
    { "title": "Там, где раки поют", "desc": "Атмосферная мелодрама о девушке, выросшей в одиночестве на болотах.", "kinopoisk": "https://www.kinopoisk.ru/film/1396525/", "url": "https://lordfilm.ai/3874-tam-gde-raki-pojut.html" },
    { "title": "Мой ужасный сосед", "desc": "Добрая комедия с Томом Хэнксом о ворчливом старике.", "kinopoisk": "https://www.kinopoisk.ru/film/1074910/", "url": "https://lordfilm.ai/4357-moj-uzhasnyj-sosed.html" },
    { "title": "Дюна: Часть вторая", "desc": "Визуальный шедевр о мести и судьбе Пола Атрейдеса.", "kinopoisk": "https://www.kinopoisk.ru/film/4540126/", "url": "https://lordfilm.ai/53-dune-part-two-2023.html" },
    { "title": "Школа добра и зла", "desc": "Фэнтези о приключениях подруг в необычной магической академии.", "kinopoisk": "https://www.kinopoisk.ru/film/764773/", "url": "https://lordfilm.ai/684-shkola-dobra-i-zla-2022.html" },
    { "title": "Аватар: Путь воды", "desc": "Возвращение на Пандору с невероятными подводными приключениями.", "kinopoisk": "https://www.kinopoisk.ru/film/505898/", "url": "https://lordfilm.ai/1419-avatar-put-vody-2022.html" },
    { "title": "Источник вечной молодости", "desc": "Фантастический квест в поисках легендарного артефакта.", "kinopoisk": "https://www.kinopoisk.ru/film/5437611/", "url": "https://lordfilm.ai/9248-istochnik-vechnoj-molodosti.html" },
    { "title": "Невидимая сторона", "desc": "Вдохновляющая реальная история о доброте и спорте.", "kinopoisk": "https://www.kinopoisk.ru/film/450213/", "url": "https://lordfilm.ai/4390-nevidimaja-storona.html" },
    { "title": "Трон: Арес", "desc": "Долгожданное возвращение в цифровую вселенную «Трона».", "kinopoisk": "https://www.kinopoisk.ru/film/634944/", "url": "https://lordfilm.ai/9575-tron-ares.html" },
    { "title": "65", "desc": "Фантастический боевик о выживании пилота на Земле 65 миллионов лет назад.", "kinopoisk": "https://www.kinopoisk.ru/film/1382210/", "url": "https://lordfilm.ai/1883-65-2023.html" },
    { "title": "Новичок", "desc": "Драма о целеустремленности и суровых испытаниях в спорте.", "url": "https://lordfilm.ai/9134-novichok.html" },
    { "title": "Пассажиры", "desc": "Романтическая фантастика о любви на космическом лайнере.", "kinopoisk": "https://www.kinopoisk.ru/film/470689/", "url": "https://lordfilm.ai/4794-passazhiry.html" },
    { "title": "Годзилла и Конг: Новая империя", "desc": "Грандиозный союз двух титанов против новой угрозы.", "kinopoisk": "https://www.kinopoisk.ru/film/4902648/", "url": "https://lordfilm.ai/3070-godzilla-i-kong-novaja-imperija.html" },
    { "title": "Материнский инстинкт", "desc": "Психологический триллер о дружбе двух соседок после трагедии.", "kinopoisk": "https://www.kinopoisk.ru/film/4967684/", "url": "https://lordfilm.ai/6823-materinskij-instinkt.html" },
    { "title": "На краю земли", "desc": "Приключенческая драма о выживании в дикой природе.", "url": "https://lordfilm.ai/4081-na-kraju-zemli.html" },
    { "title": "Капернаум", "desc": "Трогательная история ребенка, подавшего в суд на родителей.", "kinopoisk": "https://www.kinopoisk.ru/film/1118042/", "url": "https://lordfilm.ai/2253-kapernaum-2018.html" },
    { "title": "Тайна в его глазах", "desc": "Завораживающий детектив о преступлении прошлого и любви.", "kinopoisk": "https://www.kinopoisk.ru/film/428003/", "url": "https://lordfilm.ai/6628-tajna-v-ee-glazah.html" },
    { "title": "Грабитель с крыши", "desc": "Криминальная комедия о необычном воре и его приключениях.", "kinopoisk": "https://www.kinopoisk.ru/film/979438/", "url": "https://lordfilm.ai/9561-grabitel-s-kryshi.html" },
    { "title": "Профессионал", "desc": "Классический боевик об агенте, идущем против системы.", "kinopoisk": "https://www.kinopoisk.ru/film/39259/", "url": "https://lordfilm.ai/7051-professional.html" },
    { "title": "Один дома", "desc": "Главная рождественская комедия всех времен для всей семьи.", "kinopoisk": "https://www.kinopoisk.ru/film/8124/", "url": "https://lordfilm.ai/775-odin-doma-1990.html" },
    { "title": "Пастырь", "desc": "Постапокалиптическое фэнтези о борьбе с вампирами.", "kinopoisk": "https://www.kinopoisk.ru/film/258759/", "url": "https://lordfilm.ai/2924-pastyr.html" },
    { "title": "Каскадеры", "desc": "Комедийный боевик о мастере трюков и закулисье кино.", "kinopoisk": "https://www.kinopoisk.ru/film/535243/", "url": "https://lordfilm.ai/3105-kaskadery.html" },
    { "title": "Охота на воров 2: Пантера", "desc": "Суровое противостояние грабителей и элитного спецотряда полиции.", "kinopoisk": "https://www.kinopoisk.ru/film/1115213/", "url": "https://lordfilm.ai/8708-ohota-na-vorov-2-pantera.html" },
    { "title": "Подземелья и драконы: Воровская честь", "desc": "Увлекательное фэнтези-приключение с отличным юмором.", "kinopoisk": "https://www.kinopoisk.ru/film/762646/", "url": "https://lordfilm.ai/1301-podzemelja-i-drakony-vorovskaja-chest-2023.html" },
    { "title": "Пираты Карибского моря: Проклятие Черной жемчужины", "desc": "Легендарное начало приключений капитана Джека Воробья.", "kinopoisk": "https://www.kinopoisk.ru/film/4374/", "url": "https://lordfilm.ai/2229-piraty-karibskogo-morja-prokljatie-chernoj-zhemchuzhiny-2003.html" },
    { "title": "Воздушное ограбление", "desc": "Динамичный экшн о дерзком преступлении на борту самолета.", "kinopoisk": "https://www.kinopoisk.ru/film/4422792/", "url": "https://lordfilm.ai/956-vozdushnoe-ograblenie-2024.html" },
    { "title": "Бугимен", "desc": "Жуткая история о монстре, скрывающемся в шкафу.", "kinopoisk": "https://www.kinopoisk.ru/film/819105/", "url": "https://lordfilm.ai/61-bugimen-2023.html" },
    { "title": "Мой домашний крокодил", "desc": "Музыкальная комедия о крокодиле, который любит петь.", "kinopoisk": "https://www.kinopoisk.ru/film/4511239/", "url": "https://lordfilm.ai/3962-moj-domashnij-krokodil.html" },
    { "title": "Компаньон", "desc": "Фантастический триллер о необычных отношениях человека и ИИ.", "kinopoisk": "https://www.kinopoisk.ru/film/6275518/", "url": "https://lordfilm.ai/8695-kompanon.html" },
    { "title": "Черепашки-ниндзя 2", "desc": "Больше драйва и битв в приключениях знаменитой четверки мутантов.", "kinopoisk": "https://www.kinopoisk.ru/film/841518/", "url": "https://lordfilm.ai/1488-cherepashki-nindzja-2-2016.html" }
];

/**
 * Recipe recommendations for admin posts
 */
export const RECIPES = [
    { "title": "Апельсиновый пирог-перевертыш в духовке", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/63122/apelsinovyj-pirog-perevertysh-v-duhovke" },
    { "title": "Ананас с медом и брынзой", "desc": "простое и вкусное блюдо на каждый день", "url": "https://www.gastronom.ru/recipe/63501/ananas-s-medom-i-brynzoj" },
    { "title": "Азиатские фрикадельки", "desc": "сытное основное блюдо для ужина", "url": "https://www.gastronom.ru/recipe/41528/aziatskie-frikadelki" },
    { "title": "Азу по-татарски с солеными огурцами в пароварке", "desc": "согревающий обед с богатым вкусом", "url": "https://www.gastronom.ru/recipe/19684/azu-po-tatarski-s-solenymi-ogurcami-v-parovarke" },
    { "title": "Армянская сладость гата", "desc": "простое и вкусное блюдо на каждый день", "url": "https://www.gastronom.ru/recipe/14754/armyanskaya-sladost-gata" },
    { "title": "Американский шоколадный бисквит", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/63448/amerikanskij-shokoladnyj-biskvit" },
    { "title": "Ананасовый бисквитный торт", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/13503/ananasovyj-tort" },
    { "title": "Апельсиновый ликер", "desc": "освежающий напиток для настроения", "url": "https://www.gastronom.ru/recipe/4547/apelsinovyj-liker" },
    { "title": "Апельсиновый пирог с карамелью и ликёром", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/63660/apelsinovyi-pirog-s-karameliu-i-likerom" },
    { "title": "Азу по-татарски в мультиварке", "desc": "сытное основное блюдо для ужина", "url": "https://www.gastronom.ru/recipe/62259/azu-po-tatarski-v-multivarke" },
    { "title": "Апельсиновый чай", "desc": "освежающий напиток для настроения", "url": "https://www.gastronom.ru/recipe/7719/apelsinovyj-chaj" },
    { "title": "Апельсиновое варенье", "desc": "простое и вкусное блюдо на каждый день", "url": "https://www.gastronom.ru/recipe/14873/apelsinovoe-varene" },
    { "title": "Апельсиновая настойка", "desc": "освежающий напиток для настроения", "url": "https://www.gastronom.ru/recipe/61805/apelsinovaya-nastojka" },
    { "title": "Апельсиновое желе", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/7250/apelsinovoe-zhele" },
    { "title": "Апельсиновые оладьи", "desc": "простое и вкусное блюдо на каждый день", "url": "https://www.gastronom.ru/recipe/23588/apelsinovye-oladi" },
    { "title": "Апельсиновый глинтвейн", "desc": "освежающий напиток для настроения", "url": "https://www.gastronom.ru/recipe/2762/apelsinovyj-glintvejn" },
    { "title": "Азиатские пирожки", "desc": "простое и вкусное блюдо на каждый день", "url": "https://www.gastronom.ru/recipe/21254/aziatskie-pirozhki" },
    { "title": "Австрийский торт «Захер»", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/10587/avstrijskij-tort-zaher" },
    { "title": "Амарантовые блины с авокадо и беконом", "desc": "простое и вкусное блюдо на каждый день", "url": "https://www.gastronom.ru/recipe/48302/amarantovye-bliny-s-avokado-i-bekonom" },
    { "title": "Апельсиновый и лимонный сорбет", "desc": "освежающий десерт для настроения", "url": "https://www.gastronom.ru/recipe/7128/apelsinovyj-i-limonnyj-sorbet" },
    { "title": "Апельсиновый сахар", "desc": "простое и вкусное дополнение", "url": "https://www.gastronom.ru/recipe/48318/apelsinovyj-sahar" },
    { "title": "Ароматная картошка с грибами и зеленым маслом", "desc": "сытный гарнир для всей семьи", "url": "https://www.gastronom.ru/recipe/50997/aromatnaya-kartoshka-s-gribami-i-zelenym-maslom" },
    { "title": "Апельсиновое печенье с трещинками", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/62545/apelsinovoe-pechene-s-treshinkami" },
    { "title": "Арабские блинчики \"Катаеф\"", "desc": "оригинальный десерт для гостей", "url": "https://www.gastronom.ru/recipe/48253/arabskie-blinchiki-kataef" },
    { "title": "Австрийское суфле с шоколадом и фундуком", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/5218/avstrijskoe-sufle-s-shokoladom-i-fundukom" },
    { "title": "Ароматная курица в духовке для семейного праздника", "desc": "сытное основное блюдо для ужина", "url": "https://www.gastronom.ru/recipe/63227/aromatnaia-kuritsa-v-dukhovke-dlia-semeinogo-prazdnika" },
    { "title": "Апельсиновый хлеб", "desc": "ароматная выпечка на каждый день", "url": "https://www.gastronom.ru/recipe/22064/apelsinovyj-hleb" },
    { "title": "Апельсиновая булка", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/39666/apelsinovaya-bulka" },
    { "title": "Азу из курицы с солеными огурцами", "desc": "сытное основное блюдо для ужина", "url": "https://www.gastronom.ru/recipe/62437/azu-iz-kuricy-s-solenymi-ogurcami" },
    { "title": "Апельсиновая шарлотка-перевёртыш по-итальянски", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/39743/apelsinovaya-sharlotka-perevyortysh-po-italyanski" },
    { "title": "А-ля мясо по-французски", "desc": "сытное основное блюдо для ужина", "url": "https://www.gastronom.ru/recipe/63189/a-lia-miaso-po-frantsuzski" },
    { "title": "Аджапсандали в мультиварке", "desc": "полезное овощное блюдо", "url": "https://www.gastronom.ru/recipe/21580/adzhapsandali-v-multivarke" },
    { "title": "Армянская Пахлава", "desc": "традиционный сладкий десерт", "url": "https://www.gastronom.ru/recipe/63130/armianskaia-pakhlava" },
    { "title": "Аргентинское печенье \"Альфахорес\"", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/33456/argentinskoe-pechene-alfahores" },
    { "title": "Ангельский бисквит на белках", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/46467/angelskij-biskvit-na-belkah" },
    { "title": "Апельсиново-йогуртовый пирог", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/39643/apelsinovo-jogurtnyj-pirog" },
    { "title": "Апельсиновые тарталетки Creme De Cappucino", "desc": "изысканный десерт для праздника", "url": "https://www.gastronom.ru/recipe/15649/apelsinovye-tartaletki-creme-de-cappucino" },
    { "title": "Антрекот из свинины", "desc": "сытное основное блюдо для ужина", "url": "https://www.gastronom.ru/recipe/62624/antrekot-iz-svininy" },
    { "title": "Апельсиновый торт", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/15716/apelsinovyj-tort" },
    { "title": "Аиго болидо", "desc": "традиционный французский суп", "url": "https://www.gastronom.ru/recipe/25396/aigo-bolido" },
    { "title": "Апельсиновый пирог в глазури", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/6999/apelsinovyj-pirog" },
    { "title": "Апельсиновые маффины и рождественский чай", "desc": "уютное угощение для зимнего вечера", "url": "https://www.gastronom.ru/recipe/11824/apelsinovye-maffiny-i-rozhdestvenskij-chaj" },
    { "title": "Апельсиновая икра", "desc": "оригинальный десерт для гурманов", "url": "https://www.gastronom.ru/recipe/28503/apelsinovaya-ikra" },
    { "title": "Альтернативная шарлотка", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/48287/alternativnaya-sharlotka" },
    { "title": "Апельсины с ромом и карамелью", "desc": "изысканный фруктовый десерт", "url": "https://www.gastronom.ru/recipe/25485/apelsiny-s-romom-i-karamelyu" },
    { "title": "Апельсиновый чай с коньяком", "desc": "согревающий напиток для вечера", "url": "https://www.gastronom.ru/recipe/39710/apelsinovyj-chaj-s-konyakom" },
    { "title": "Апельсиново-шоколадное печенье", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/33606/apelsinovo-shokoladnoe-pechene" },
    { "title": "Ароматный плов", "desc": "сытный обед для большой компании", "url": "https://www.gastronom.ru/recipe/62675/aromatnyi-plov" },
    { "title": "Айнтопф из гуся с краснокочанной капустой в мультиварке", "desc": "сытное и наваристое блюдо", "url": "https://www.gastronom.ru/recipe/19426/ajntopf-iz-gusya-s-krasnokochannoj-kapustoj-v-multivarke" },
    { "title": "Апельсиновый оссобуко из говяжьей голяшки", "desc": "изысканное мясное блюдо", "url": "https://www.gastronom.ru/recipe/19245/apelsinovyj-ossobuko-iz-govyazhej-golyashki" },
    { "title": "Апельсиновый бисквитный рулет", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/50789/apelsinoviy-rulet" },
    { "title": "Ароматный рис с шалфеем", "desc": "оригинальный гарнир к мясу", "url": "https://www.gastronom.ru/recipe/39215/aromatnyj-ris-s-shalfeem" },
    { "title": "Апельсиновый манник на кефире", "desc": "простая выпечка к чаю", "url": "https://www.gastronom.ru/recipe/28339/apelsinovyj-mannik-na-kefire" },
    { "title": "Апельсиновые бискотти с миндалем и клюквой", "desc": "хрустящее печенье для кофе", "url": "https://www.gastronom.ru/recipe/61785/apelsinovye-biskotti-s-mindalem-i-klyukvoj" },
    { "title": "Ананасовый лед", "desc": "освежающий десерт в жару", "url": "https://www.gastronom.ru/recipe/11591/ananasovyj-led" },
    { "title": "Ассорти закусок", "desc": "отличное дополнение к праздничному столу", "url": "https://www.gastronom.ru/recipe/62498/assorti-zakusok" },
    { "title": "Австрийский рождественский куглоф", "desc": "праздничная выпечка с сухофруктами", "url": "https://www.gastronom.ru/recipe/42978/avstrijskij-rozhdestvenskij-kuglof" },
    { "title": "Апельсины с мёдом и корицей", "desc": "быстрый и полезный десерт", "url": "https://www.gastronom.ru/recipe/62408/zapechennye-apelsiny-s-medom-i-koritsei" },
    { "title": "Айва, запеченная в пряном меду", "desc": "ароматный зимний десерт", "url": "https://www.gastronom.ru/recipe/52635/ajva-zapechennaya-v-pryanom-medu" },
    { "title": "Абрикосовые кексы со сливочным кремом", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/25216/abrikosovye-keksy-so-slivochnym-kremom" },
    { "title": "Ананасы в слоёном тесте", "desc": "хрустящая выпечка на скорую руку", "url": "https://www.gastronom.ru/recipe/62266/ananasy-v-sloenom-teste" },
    { "title": "Австрийский чечевичный суп", "desc": "согревающий обед с богатым вкусом", "url": "https://www.gastronom.ru/recipe/11719/avstrijskij-chechevichnyj-sup" },
    { "title": "Ачма от шефа", "desc": "сытный сырный пирог", "url": "https://www.gastronom.ru/recipe/39416/achma" },
    { "title": "Азу из свинины", "desc": "сытное основное блюдо для ужина", "url": "https://www.gastronom.ru/recipe/56395/azu-iz-svininy" },
    { "title": "Авокадо с икрой", "desc": "изысканная закуска для особого случая", "url": "https://www.gastronom.ru/recipe/6914/avokado-s-ikroj" },
    { "title": "Апельсиновые оладьи без яиц", "desc": "легкий завтрак для всей семьи", "url": "https://www.gastronom.ru/recipe/25443/apelsinovye-oladi-bez-yaic" },
    { "title": "Авокадо-бургер", "desc": "оригинальная альтернатива классике", "url": "https://www.gastronom.ru/recipe/62140/avokado-burger" },
    { "title": "Ананасовые кольца с креветками", "desc": "экзотическая закуска для праздника", "url": "https://www.gastronom.ru/recipe/19165/ananasovye-kolca-s-krevetkami" },
    { "title": "Айва с начинкой из пряного мясного фарша под сырной корочкой", "desc": "сытное запеченное блюдо", "url": "https://www.gastronom.ru/recipe/11670/ajva-s-nachinkoj-iz-pryanogo-myasnogo-farsha-pod-syrnoj-korochkoj" },
    { "title": "Американские панкейки с сюрпризом", "desc": "идеальный завтрак выходного дня", "url": "https://www.gastronom.ru/recipe/42320/amerikanskie-pankejki-ot-maksima-altshulya" },
    { "title": "Апельсиновый кекс с сухофруктами и цукатами", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/54274/apelsinovyj-pryanyj-keks-s-suhofruktami-i-cukatami" },
    { "title": "Андижанский плов", "desc": "настоящий восточный обед", "url": "https://www.gastronom.ru/recipe/24438/andizhanskij-plov" },
    { "title": "Ароматный лимонный кекс", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/42830/aromatnyj-limonnyj-keks" },
    { "title": "Английский ролл со свининой", "desc": "сытная закуска в дорогу", "url": "https://www.gastronom.ru/recipe/45652/anglijskij-roll-so-svininoj" },
    { "title": "Армянский спас", "desc": "легкий и освежающий суп", "url": "https://www.gastronom.ru/recipe/33083/armyanskij-spas" },
    { "title": "Ароматный тыквенный крем-суп с мясом краба", "desc": "изысканный обед для гурманов", "url": "https://www.gastronom.ru/recipe/39681/aromatnyj-tykvennyj-krem-sup-s-myasom-kraba" },
    { "title": "Ананасовый пирог", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/22518/ananasovyj-pirog" },
    { "title": "Ароматные булочки и поросята", "desc": "веселая выпечка для детей", "url": "https://www.gastronom.ru/recipe/45736/aromatnye-bulochki-i-porosyata" },
    { "title": "Ананасовые лодочки", "desc": "эффектная подача фруктового салата", "url": "https://www.gastronom.ru/recipe/25233/ananasovye-lodochki" },
    { "title": "Анжулькин картофель", "desc": "простой и вкусный гарнир", "url": "https://www.gastronom.ru/recipe/11713/anzhulkin-kartofel" },
    { "title": "Александровская полоска", "desc": "легендарное пирожное из детства", "url": "https://www.gastronom.ru/recipe/32804/aleksandrovskaja-poloska" },
    { "title": "Апфельмусс-торт", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/39173/apfelmuss-tort" },
    { "title": "Арахисовые капкейки с арахисовым кремом", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/19063/arahisovye-kapkejki-s-arahisovym-kremom" },
    { "title": "Армянский суп с фрикадельками Кололик", "desc": "согревающий обед с богатым вкусом", "url": "https://www.gastronom.ru/recipe/54238/armyanskij-sup-s-frikadelkami-kololik" },
    { "title": "Аппетитные тосты", "desc": "быстрый завтрак на каждый день", "url": "https://www.gastronom.ru/recipe/52390/appetitnye-tosty" },
    { "title": "Арахисовые оладьи", "desc": "необычный завтрак для всей семьи", "url": "https://www.gastronom.ru/recipe/61656/arahisovye-oladi" },
    { "title": "Ароматная утка с картошкой в рукаве", "desc": "сытное основное блюдо для ужина", "url": "https://www.gastronom.ru/recipe/54284/aromatnaja-utka-s-kartoshkoj-v-rukave" },
    { "title": "Азиатские рулетики со свининой для дружеской вечеринки", "desc": "отличная закуска для компании", "url": "https://www.gastronom.ru/recipe/45861/aziatskie-ruletiki-so-svininoj-dlya-druzheskoj-vecherinki" },
    { "title": "Австрийский компот из инжира", "desc": "необычный и полезный напиток", "url": "https://www.gastronom.ru/recipe/25020/avstrijskij-kompot-iz-inzhira" },
    { "title": "Айнтопф со свиными рёбрышками", "desc": "густой и сытный суп", "url": "https://www.gastronom.ru/recipe/38631/ajntopf" },
    { "title": "Авокадо с мясом сурими", "desc": "легкая и быстрая закуска", "url": "https://www.gastronom.ru/recipe/19300/avokado-s-myasom-surimi" },
    { "title": "Абрикосовые кексы", "desc": "нежный десерт для всей семьи", "url": "https://www.gastronom.ru/recipe/50881/abrikosovye-keksy" },
    { "title": "Ананасовая сальса к мясу", "desc": "пикантный соус для барбекю", "url": "https://www.gastronom.ru/recipe/22484/ananasovaya-salsa-k-myasu" },
    { "title": "Ахи-поке или Суши по-гавайски", "desc": "модное и полезное блюдо", "url": "https://www.gastronom.ru/recipe/43142/ahi-poki-ili-sushi-po-gavajski-" },
    { "title": "Английский суп из чечевицы с пастернаком, яблоками и голубым сыром", "desc": "изысканный согревающий обед", "url": "https://www.gastronom.ru/recipe/50600/anglijskij-sup-iz-chechevicy-s-pasternakom-yablokami-i-golubym-syrom" },
    { "title": "Альтернатива Мимозе и Селедке под шубой - новогодний салат с лососем", "desc": "свежий взгляд на традицию", "url": "https://www.gastronom.ru/recipe/39006/novogodnij-salat-s-lososem" },
    { "title": "Австрийский штоллен", "desc": "традиционная рождественская выпечка", "url": "https://www.gastronom.ru/recipe/50426/avstrijskij-shtollen" },
    { "title": "Астурианская фабада", "desc": "классика испанской кухни", "url": "https://www.gastronom.ru/recipe/18788/asturianskaya-fabada" },
    { "title": "Авокадо с огуречным кремом и креветками", "desc": "нежная праздничная закуска", "url": "https://www.gastronom.ru/recipe/5118/avokado-s-ogurechnym-kremom-i-krevetkami" },
    { "title": "Американское печенье с орехами и корицей", "desc": "ароматное лакомство к чаю", "url": "https://www.gastronom.ru/recipe/42659/amerikanskoe-pechene-s-orehami-i-koricej" }
];
