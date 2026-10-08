/**
 * Built-in reading passages. Short, spoken-register texts suited to pronunciation
 * practice. Hosts can also paste a custom passage.
 */
import type { LanguageCode, Level, Passage } from "./room-model";

type LibraryPassage = Required<Pick<Passage, "id" | "title" | "text" | "language" | "level">>;

const P = (id: string, language: LanguageCode, level: Level, title: string, text: string): LibraryPassage => ({
  id,
  language,
  level,
  title,
  text,
});

export const PASSAGE_LIBRARY: LibraryPassage[] = [
  // English
  P("en-b1", "en", "beginner", "A morning at the market",
    "Every Saturday I walk to the market near my house. I buy fresh bread, three apples, and a small bunch of flowers. The woman at the fruit stand always smiles and says, \"Good morning!\" I like to answer her slowly and clearly."),
  P("en-i1", "en", "intermediate", "Learning to listen",
    "When I first moved abroad, I thought speaking was the hardest part of a new language. I was wrong. Listening was harder, because people did not pause for me. Over time I learned to catch the stressed words and let the rest wash over me. That changed everything."),
  P("en-a1", "en", "advanced", "The quiet library",
    "There is a particular hush in a library on a rainy afternoon, a silence thick enough to notice. Pages turn, a chair scrapes, someone stifles a cough, and somehow the quiet absorbs it all. I have never found a better place to think, though I rarely manage to read."),
  // Spanish
  P("es-b1", "es", "beginner", "Mi familia",
    "Me llamo Lucía y vivo en Valencia con mi familia. Tengo un hermano mayor y una hermana pequeña. Por la mañana desayunamos juntos y después voy a la escuela en bicicleta. Los domingos visitamos a mis abuelos."),
  P("es-i1", "es", "intermediate", "Un viaje en tren",
    "El tren salió de la estación con diez minutos de retraso, pero a nadie pareció importarle. Afuera, los campos de olivos pasaban lentamente bajo un cielo sin nubes. Saqué mi libro, aunque sabía que acabaría mirando por la ventana."),
  P("es-a1", "es", "advanced", "La plaza al atardecer",
    "Al caer la tarde, la plaza se llena de un rumor suave: conversaciones a media voz, el tintineo de las tazas y, de vez en cuando, la risa de algún niño que corre entre las mesas. Es un momento que parece suspendido, como si la ciudad respirara hondo antes de la noche."),
  // French
  P("fr-b1", "fr", "beginner", "Au café",
    "Le matin, je vais au café près de la gare. Je commande un croissant et un café au lait. Le serveur est très gentil et il parle lentement avec moi. Je dis « merci » et « bonne journée » avant de partir."),
  P("fr-i1", "fr", "intermediate", "Une lettre à un ami",
    "Cher Thomas, je t'écris depuis un petit village au bord de la mer. Ici, les journées passent doucement : on se lève tard, on marche sur la plage, on lit à l'ombre. Je pense souvent à nos discussions et j'ai hâte de te raconter tout cela de vive voix."),
  P("fr-a1", "fr", "advanced", "La pluie sur les toits",
    "Il y a dans le bruit de la pluie sur les toits de zinc quelque chose d'apaisant que je ne saurais expliquer. Peut-être est-ce la régularité du rythme, ou le souvenir des soirées d'enfance passées à la fenêtre. Toujours est-il que, lorsqu'il pleut, la ville me semble enfin à l'écoute."),
  // German
  P("de-b1", "de", "beginner", "Mein Tag",
    "Ich stehe um sieben Uhr auf und trinke eine Tasse Kaffee. Dann fahre ich mit dem Bus zur Arbeit. Am Abend koche ich gern und höre Musik. Am Wochenende gehe ich mit meinen Freunden im Park spazieren."),
  P("de-i1", "de", "intermediate", "Ein Besuch in Berlin",
    "Als ich zum ersten Mal nach Berlin kam, war ich überrascht, wie grün die Stadt ist. Zwischen den alten Fassaden gibt es überall Bäume, Höfe und kleine Gärten. Ich habe stundenlang zu Fuß gelaufen und trotzdem das Gefühl gehabt, kaum etwas gesehen zu haben."),
  P("de-a1", "de", "advanced", "Herbst am Fluss",
    "Im Herbst liegt über dem Fluss ein feiner Nebel, der sich erst gegen Mittag auflöst. Die Blätter treiben langsam stromabwärts, und die wenigen Spaziergänger sprechen leiser als sonst, als wollten sie die Stille nicht stören. Es ist eine Jahreszeit, die zum Nachdenken einlädt."),
  // Vietnamese
  P("vi-b1", "vi", "beginner", "Bữa sáng ở quán",
    "Buổi sáng, tôi thường ăn phở ở quán gần nhà. Cô chủ quán rất vui vẻ và hay hỏi tôi: \"Hôm nay con ăn gì?\" Tôi trả lời chậm rãi và rõ ràng. Sau đó tôi uống một ly cà phê sữa đá rồi đi làm."),
  P("vi-i1", "vi", "intermediate", "Một buổi chiều ở Hà Nội",
    "Chiều muộn, tôi đi dạo quanh Hồ Gươm. Gió từ mặt hồ thổi lên mát rượi, còn trên phố, tiếng xe máy dần thưa hơn. Tôi ngồi xuống một chiếc ghế đá, nhìn những người lớn tuổi tập thể dục và nghĩ rằng thành phố này có một nhịp sống rất riêng."),
  P("vi-a1", "vi", "advanced", "Mùa mưa",
    "Mùa mưa ở miền Nam đến rất đúng hẹn. Cứ khoảng ba giờ chiều, bầu trời sầm lại, rồi cơn mưa ào xuống như trút nước, chỉ chừng nửa tiếng là tạnh. Sau mưa, không khí dịu hẳn, mùi đất ẩm bốc lên, và người ta lại ùa ra đường như chưa từng có gì xảy ra."),
  // Japanese
  P("ja-b1", "ja", "beginner", "わたしの一日",
    "わたしは毎朝七時に起きます。朝ごはんにパンとコーヒーを食べます。それから電車で会社に行きます。夜は友だちと電話で話します。"),
  P("ja-i1", "ja", "intermediate", "雨の日の散歩",
    "日曜日の朝、小さな雨が降っていました。傘を持って近所の公園を歩くと、人はほとんどいませんでした。濡れた葉のにおいがして、いつもより静かな時間が流れていました。"),
  P("ja-a1", "ja", "advanced", "古い喫茶店",
    "駅の裏にある古い喫茶店には、何十年も変わらない空気がある。木の椅子はきしみ、レコードは少し音が割れている。それでも、ここでコーヒーを飲むたびに、急いで生きることをやめてもいいのだと思わされる。"),
  // Korean
  P("ko-b1", "ko", "beginner", "주말 아침",
    "주말 아침에는 늦게 일어납니다. 커피를 마시고 창문을 열어요. 날씨가 좋으면 친구와 공원에 갑니다. 저녁에는 가족과 함께 밥을 먹습니다."),
  P("ko-i1", "ko", "intermediate", "첫 번째 서울 여행",
    "처음 서울에 갔을 때, 지하철이 너무 복잡해서 길을 잃을까 걱정했습니다. 하지만 사람들은 친절하게 길을 알려 주었고, 저는 조금씩 자신감이 생겼습니다. 여행이 끝날 때쯤에는 지도를 보지 않고도 다닐 수 있었습니다."),
  P("ko-a1", "ko", "advanced", "바다가 보이는 마을",
    "그 마을에서는 어디서든 바다가 보였다. 아침마다 안개가 천천히 걷히고, 어선들이 하나씩 항구로 돌아왔다. 사람들은 서두르지 않았고, 시간은 파도처럼 일정한 리듬으로 흘러갔다."),
  // Chinese
  P("zh-b1", "zh", "beginner", "我的早上",
    "我每天早上六点半起床。我先喝一杯水，然后吃早饭。早饭我喜欢吃包子和喝豆浆。吃完饭以后，我坐地铁去上班。"),
  P("zh-i1", "zh", "intermediate", "雨中的小城",
    "周末我去了一个南方的小城。那天一直下着小雨，街道两边的老房子被雨水洗得很干净。我在一家茶馆坐了一个下午，听雨声，看来来往往的人，觉得时间变慢了。"),
  P("zh-a1", "zh", "advanced", "夜晚的书店",
    "深夜的书店有一种独特的安静。灯光柔和，纸张的气味淡淡地弥漫在空气里，偶尔传来翻页的声音。在这里，人们似乎暂时放下了白天的匆忙，愿意为一本书停留很久。"),
];

export function passagesFor(language: LanguageCode, level?: Level): LibraryPassage[] {
  return PASSAGE_LIBRARY.filter((p) => p.language === language && (!level || p.level === level));
}

export function findPassage(id: string): LibraryPassage | undefined {
  return PASSAGE_LIBRARY.find((p) => p.id === id);
}

export function defaultPassage(language: LanguageCode, level: Level): Passage {
  const exact = passagesFor(language, level)[0] ?? passagesFor(language)[0] ?? PASSAGE_LIBRARY[0]!;
  return { ...exact, source: "library" };
}

export function libraryPassage(entry: LibraryPassage): Passage {
  return { ...entry, source: "library" };
}
