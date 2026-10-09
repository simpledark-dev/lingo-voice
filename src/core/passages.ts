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
    "Every Saturday I walk to the market near my house. It opens early, so I leave home at eight o'clock with a big cloth bag. First I buy fresh bread from the baker, who always gives me a small piece to taste. Then I choose three apples, a bunch of bananas, and a small bunch of flowers for my kitchen table. The woman at the fruit stand always smiles and says, \"Good morning! How are you today?\" I like to answer her slowly and clearly, and she helps me when I forget a word. On the way home I stop for a coffee and watch the people go by. It is my favourite hour of the week."),
  P("en-i1", "en", "intermediate", "Learning to listen",
    "When I first moved abroad, I thought speaking was the hardest part of a new language. I was wrong. Listening was harder, because people did not pause for me, and they did not use the sentences from my textbook. In shops I nodded and hoped for the best. On the phone I panicked. Over time I learned a trick: instead of trying to catch every word, I listened for the stressed ones, the words people say louder and longer, and let the rest wash over me. Slowly the noise turned into meaning. Now, when a friend speaks quickly, I no longer freeze. I catch the shape of what they mean, ask one short question, and keep the conversation going. That change, more than any grammar rule, is what made me feel at home."),
  P("en-a1", "en", "advanced", "The quiet library",
    "There is a particular hush in a library on a rainy afternoon, a silence thick enough to notice, as if the building itself were holding its breath. Pages turn, a chair scrapes, someone stifles a cough behind a shelf of atlases, and somehow the quiet absorbs it all without complaint. Outside, buses hiss past on the wet road and umbrellas bloom and fold along the pavement, but in here the weather is only a rumour at the windows. I have never found a better place to think, though I rarely manage to read; the books seem less like things to be finished than company to be kept. Perhaps that is the real purpose of such rooms: not to make us more informed, but to make us, for an hour or two, more patient with ourselves."),
  // Spanish
  P("es-b1", "es", "beginner", "Mi familia",
    "Me llamo Lucía y vivo en Valencia con mi familia. Tengo un hermano mayor que se llama Pablo y una hermana pequeña que se llama Ana. Mi padre trabaja en un hospital y mi madre es profesora de música. Por la mañana desayunamos juntos: pan con tomate, zumo de naranja y café para mis padres. Después voy a la escuela en bicicleta, porque está cerca de casa. Por la tarde hago los deberes y juego con mi hermana en el parque. Los domingos visitamos a mis abuelos, que viven en un pueblo pequeño junto al mar. Mi abuela siempre prepara paella y mi abuelo nos cuenta historias de cuando era joven."),
  P("es-i1", "es", "intermediate", "Un viaje en tren",
    "El tren salió de la estación con diez minutos de retraso, pero a nadie pareció importarle. Era una mañana de finales de septiembre y el vagón olía a café y a periódico recién abierto. Afuera, los campos de olivos pasaban lentamente bajo un cielo sin nubes, y de vez en cuando aparecía un pueblo blanco colgado de una colina. Saqué mi libro, aunque sabía que acabaría mirando por la ventana. En el asiento de enfrente, una señora mayor pelaba una naranja con mucho cuidado y me ofreció un gajo sin decir nada. Hablamos durante casi una hora: de su nieto, que estudiaba en Madrid, de la sequía, de lo caro que estaba todo. Cuando bajó en Córdoba me di cuenta de que no nos habíamos dicho nuestros nombres, y de que no hacía falta."),
  P("es-a1", "es", "advanced", "La plaza al atardecer",
    "Al caer la tarde, la plaza se llena de un rumor suave: conversaciones a media voz, el tintineo de las tazas en la terraza del café y, de vez en cuando, la risa de algún niño que corre entre las mesas persiguiendo a una paloma. La luz, que durante el día golpeaba sin piedad las fachadas, se vuelve dorada y perdona hasta las grietas más viejas. Los vecinos salen a los balcones, los camareros aflojan el paso y los vendedores de lotería repiten su cantinela con menos convicción que por la mañana. Es un momento que parece suspendido, como si la ciudad respirara hondo antes de la noche y nadie quisiera ser el primero en romper el hechizo. Luego se encienden las farolas, alguien pide la cuenta, y la plaza vuelve a ser, sencillamente, una plaza."),
  // French
  P("fr-b1", "fr", "beginner", "Au café",
    "Le matin, je vais au café près de la gare avant d'aller au travail. Je commande toujours la même chose : un croissant et un café au lait. Le serveur s'appelle Julien ; il est très gentil et il parle lentement avec moi, parce qu'il sait que j'apprends le français. Je m'assieds près de la fenêtre et je regarde les gens qui passent avec leurs parapluies. Parfois, une vieille dame avec un petit chien vient s'asseoir à côté de moi, et nous parlons du temps qu'il fait. Quand je pars, je dis « merci » et « bonne journée », et Julien répond : « À demain ! » C'est un petit moment, mais il me rend heureux."),
  P("fr-i1", "fr", "intermediate", "Une lettre à un ami",
    "Cher Thomas, je t'écris depuis un petit village au bord de la mer, dans une maison que ma tante nous prête pour deux semaines. Ici, les journées passent doucement : on se lève tard, on marche sur la plage jusqu'au phare, on lit à l'ombre du figuier pendant les heures les plus chaudes. Le soir, nous allons au port acheter du poisson aux pêcheurs qui rentrent, et nous le faisons griller dans le jardin. Il n'y a presque pas de réseau, et c'est sans doute ce qui me fait le plus de bien. Je pense souvent à nos discussions de l'hiver dernier, à ce que tu disais sur le besoin de ralentir, et je crois que tu avais raison. J'ai hâte de te raconter tout cela de vive voix. Embrasse Claire pour moi."),
  P("fr-a1", "fr", "advanced", "La pluie sur les toits",
    "Il y a dans le bruit de la pluie sur les toits de zinc quelque chose d'apaisant que je ne saurais expliquer tout à fait. Peut-être est-ce la régularité du rythme, ce tambourinement patient qui ne demande rien à personne, ou le souvenir des soirées d'enfance passées à la fenêtre, le front contre la vitre froide, à compter les gouttes. Toujours est-il que, lorsqu'il pleut, la ville me semble enfin à l'écoute : les klaxons se taisent, les pas se font plus pressés mais plus discrets, et les conversations se réfugient sous les porches, à voix basse, comme dans une église. On dit que Paris est belle sous le soleil ; je la préfère ainsi, grise et luisante, quand elle cesse un instant de se donner en spectacle et consent, enfin, à n'être qu'un abri."),
  // German
  P("de-b1", "de", "beginner", "Mein Tag",
    "Ich stehe jeden Morgen um sieben Uhr auf und trinke zuerst eine große Tasse Kaffee in der Küche. Dann dusche ich, ziehe mich an und fahre mit dem Bus zur Arbeit; die Fahrt dauert ungefähr zwanzig Minuten. Im Büro arbeite ich am Computer und spreche viel mit meinen Kollegen, manchmal auf Deutsch und manchmal auf Englisch. Mittags esse ich ein Brötchen im Park, wenn das Wetter gut ist. Am Abend koche ich gern etwas Einfaches, höre Musik und rufe meine Eltern an. Am Wochenende gehe ich mit meinen Freunden im Park spazieren oder wir trinken zusammen einen Kaffee in der Stadt. Sonntags schlafe ich lange und lese ein Buch auf dem Balkon."),
  P("de-i1", "de", "intermediate", "Ein Besuch in Berlin",
    "Als ich zum ersten Mal nach Berlin kam, war ich überrascht, wie grün die Stadt ist. Zwischen den alten Fassaden gibt es überall Bäume, Hinterhöfe und kleine Gärten, in denen Nachbarn Tomaten ziehen und abends zusammen sitzen. Ich hatte eine laute, graue Großstadt erwartet und fand stattdessen Viertel, die fast wie Dörfer wirken, mit eigenem Bäcker, eigener Kneipe und eigenem Rhythmus. Ich bin stundenlang zu Fuß gelaufen, vom Prenzlauer Berg bis nach Kreuzberg, habe am Kanal gesessen und den Booten zugeschaut und trotzdem das Gefühl gehabt, kaum etwas gesehen zu haben. Am letzten Abend fragte mich ein Freund, was mir am besten gefallen habe. Ich musste lange überlegen und sagte dann: dass man hier nirgends hinmuss, um anzukommen."),
  P("de-a1", "de", "advanced", "Herbst am Fluss",
    "Im Herbst liegt über dem Fluss ein feiner Nebel, der sich erst gegen Mittag auflöst und bis dahin die Ufer in ein unentschiedenes Grau taucht. Die Blätter der Pappeln treiben langsam stromabwärts, drehen sich in kleinen Strudeln und bleiben an den Pfählen der alten Anlegestelle hängen, wo im Sommer die Ausflugsboote festmachten. Die wenigen Spaziergänger sprechen leiser als sonst, als wollten sie die Stille nicht stören, und selbst die Hunde scheinen zu wissen, dass dies keine Jahreszeit für Übermut ist. Ich gehe diesen Weg seit Jahren, und doch kommt es mir jedes Mal vor, als sähe ich ihn zum ersten Mal: Der Herbst verändert nicht die Dinge, sondern die Art, wie man sie betrachtet. Es ist eine Jahreszeit, die zum Nachdenken einlädt, und man tut gut daran, die Einladung anzunehmen."),
  // Vietnamese
  P("vi-b1", "vi", "beginner", "Bữa sáng ở quán",
    "Buổi sáng, tôi thường ăn phở ở quán nhỏ gần nhà, ngay đầu con hẻm. Quán mở từ sáu giờ, lúc nào cũng đông, nhưng tôi vẫn thích ngồi ở chiếc bàn cạnh cửa sổ. Cô chủ quán rất vui vẻ và hay hỏi tôi: \"Hôm nay con ăn gì? Tái hay chín?\" Tôi trả lời chậm rãi và rõ ràng, vì tôi đang học tiếng Việt và cô luôn kiên nhẫn sửa cho tôi. Tô phở nóng, nhiều hành, có thêm chanh và ớt. Ăn xong, tôi uống một ly cà phê sữa đá ở quán bên cạnh rồi đi làm bằng xe máy. Buổi sáng ở đây lúc nào cũng ồn ào, nhưng tôi thấy rất vui."),
  P("vi-i1", "vi", "intermediate", "Một buổi chiều ở Hà Nội",
    "Chiều muộn, tôi đi dạo quanh Hồ Gươm sau một ngày làm việc dài. Gió từ mặt hồ thổi lên mát rượi, còn trên phố, tiếng xe máy dần thưa hơn và tiếng rao của những người bán hàng rong bắt đầu vang lên. Tôi ngồi xuống một chiếc ghế đá, nhìn những người lớn tuổi tập thể dục, mấy đứa trẻ chạy theo bong bóng xà phòng, và vài du khách đang loay hoay chụp ảnh Tháp Rùa. Một bác bán trà đá hỏi tôi có uống gì không, rồi kể cho tôi nghe chuyện ngày xưa quanh hồ này như thế nào. Tôi nghĩ rằng thành phố này có một nhịp sống rất riêng: vội vã nhưng không bao giờ quá vội, ồn ào nhưng vẫn có chỗ cho một buổi chiều ngồi yên."),
  P("vi-a1", "vi", "advanced", "Mùa mưa",
    "Mùa mưa ở miền Nam đến rất đúng hẹn, như thể trời đất đã thỏa thuận với nhau từ trước. Cứ khoảng ba giờ chiều, bầu trời sầm lại, gió nổi lên cuốn theo lá khô và những tấm bạt của mấy quán vỉa hè, rồi cơn mưa ào xuống như trút nước. Người đi đường tấp vội vào mái hiên, xe cộ chậm lại, và cả thành phố dường như tạm dừng chừng nửa tiếng. Rồi mưa tạnh cũng đột ngột như lúc bắt đầu. Sau mưa, không khí dịu hẳn, mùi đất ẩm bốc lên từ những con hẻm, và người ta lại ùa ra đường như chưa từng có gì xảy ra. Tôi đã sống ở đây nhiều năm, vậy mà mỗi lần đứng dưới mái hiên nhìn mưa, tôi vẫn thấy mình như một người mới đến, lần đầu học cách chờ đợi."),
  // Japanese
  P("ja-b1", "ja", "beginner", "わたしの一日",
    "わたしは毎朝七時に起きます。まどを開けて、天気を見ます。それから、朝ごはんにパンとたまごを食べて、コーヒーを飲みます。八時に家を出て、電車で会社に行きます。電車はいつもこんでいますが、本を読む時間があるので、わたしはだいじょうぶです。会社では、同僚と日本語で話します。むずかしいことばもありますが、みんなやさしいです。昼ごはんは、近くの店でそばを食べます。夜は七時ごろ家に帰って、晩ごはんを作ります。それから、友だちと電話で話して、十一時に寝ます。"),
  P("ja-i1", "ja", "intermediate", "雨の日の散歩",
    "日曜日の朝、小さな雨が降っていました。予定はなかったので、傘を持って近所の公園へ歩いていくことにしました。公園には人がほとんどいなくて、ベンチも遊具も雨に濡れて静かに光っていました。濡れた葉のにおいがして、鳥の声がいつもよりはっきり聞こえます。池のそばで、年配の男性が一人、傘もささずに魚にえさをやっていました。わたしが会釈をすると、彼は「雨の日のほうが魚がよく来るんですよ」と教えてくれました。わたしたちはしばらく並んで池を見ていました。何も特別なことは起こらなかったのに、家に帰る道で、いつもより静かな時間が自分の中に流れているのを感じました。"),
  P("ja-a1", "ja", "advanced", "古い喫茶店",
    "駅の裏にある古い喫茶店には、何十年も変わらない空気がある。重い木の扉を押すと、カウベルが鈍く鳴り、コーヒーと古い紙の匂いが迎えてくれる。木の椅子はきしみ、レコードは少し音が割れていて、壁の時計は五分ほど遅れているが、誰もそれを直そうとしない。マスターは注文を受けると、何も言わずにゆっくりと豆を挽きはじめ、客はそれを急かさない。常連たちは新聞を読み、学生は参考書を広げ、わたしは窓の外を眺めるだけで一時間が過ぎる。ここでコーヒーを飲むたびに、急いで生きることをやめてもいいのだと思わされる。街はどんどん新しくなっていくが、この店だけは、時間のほうが客に合わせてくれているようだ。"),
  // Korean
  P("ko-b1", "ko", "beginner", "주말 아침",
    "주말 아침에는 늦게 일어납니다. 보통 아홉 시쯤 일어나서 창문을 열고 날씨를 봅니다. 그리고 부엌에서 커피를 내리고 빵을 구워서 천천히 먹습니다. 평일에는 시간이 없어서 아침을 자주 거르지만, 주말에는 꼭 먹습니다. 날씨가 좋으면 친구와 공원에 가서 산책을 하고, 비가 오면 집에서 영화를 봅니다. 오후에는 장을 보러 시장에 갑니다. 시장 아주머니들은 저에게 한국어로 천천히 말해 주셔서 공부가 많이 됩니다. 저녁에는 가족과 함께 밥을 먹고, 하루 동안 있었던 일을 이야기합니다. 주말은 짧지만 제가 가장 좋아하는 시간입니다."),
  P("ko-i1", "ko", "intermediate", "첫 번째 서울 여행",
    "처음 서울에 갔을 때, 지하철이 너무 복잡해서 길을 잃을까 봐 걱정했습니다. 노선도는 색깔이 열 가지가 넘었고, 환승역에서는 사람들이 모두 어디론가 바쁘게 걸어갔습니다. 하지만 제가 지도를 들고 두리번거리고 있으면, 사람들은 먼저 다가와서 친절하게 길을 알려 주었습니다. 한 할머니는 제 손을 잡고 출구까지 데려다주시기도 했습니다. 그렇게 하루하루 지나면서 저는 조금씩 자신감이 생겼고, 모르는 것은 물어보면 된다는 것을 배웠습니다. 여행이 끝날 때쯤에는 지도를 보지 않고도 광화문에서 홍대까지 혼자 다닐 수 있었습니다. 지금도 서울을 생각하면 높은 건물보다 그때 만난 사람들의 얼굴이 먼저 떠오릅니다."),
  P("ko-a1", "ko", "advanced", "바다가 보이는 마을",
    "그 마을에서는 어디서든 바다가 보였다. 골목 끝에서도, 학교 운동장에서도, 심지어 작은 우체국 창문 너머로도 바다는 늘 그 자리에 있었다. 아침마다 안개가 천천히 걷히고, 어선들이 하나씩 항구로 돌아오면 갈매기들이 먼저 소란을 피웠다. 사람들은 서두르지 않았다. 생선을 손질하는 손은 빨랐지만 말은 느렸고, 누군가 길에서 마주치면 반드시 오늘 날씨와 어제 잡은 고기 이야기를 나누고 나서야 헤어졌다. 도시에서 온 나는 처음에 그 느림이 답답했지만, 몇 주가 지나자 시간이 파도처럼 일정한 리듬으로 흘러간다는 것을 몸으로 느끼게 되었다. 떠나는 날 아침, 나는 처음으로 바다를 등지고 서서 마을을 오래 바라보았다."),
  // Chinese
  P("zh-b1", "zh", "beginner", "我的早上",
    "我每天早上六点半起床。起床以后，我先喝一杯温水，然后去洗脸、刷牙。七点钟我和家人一起吃早饭，早饭我最喜欢吃包子和喝豆浆，有时候也吃面条。吃完饭以后，我坐地铁去上班，地铁上人很多，但是我可以听音乐或者看手机学中文。我的公司在市中心，从家到公司要四十分钟。到了公司，我先喝一杯咖啡，然后开始工作。中午我和同事一起去食堂吃饭，我们常常一边吃饭一边聊天。这就是我普通的一个早上。"),
  P("zh-i1", "zh", "intermediate", "雨中的小城",
    "周末我去了一个南方的小城。那天一直下着小雨，街道两边的老房子被雨水洗得很干净，青石板路上反射着灯笼柔和的光。我沿着河边慢慢走，看见几位老人坐在屋檐下喝茶、下棋，谁也不着急。我在一家茶馆坐了一个下午，点了一壶龙井，听雨声打在瓦片上，看来来往往撑着伞的人。老板娘和我聊起这座城市的历史，说她的家族已经在这里住了五代人。回去的路上，我忽然觉得时间变慢了，好像这座小城有自己的钟表，走得比外面的世界慢一点，也温柔一点。"),
  P("zh-a1", "zh", "advanced", "夜晚的书店",
    "深夜的书店有一种独特的安静，与白天的安静不同，它不是没有声音，而是每一种声音都被放轻了。灯光柔和，纸张的气味淡淡地弥漫在空气里，偶尔传来翻页的声音、咖啡杯轻轻放下的声音，以及某个人在书架间小心走动的脚步声。靠窗的位置坐着一个年轻人，面前摊开一本诗集，却久久没有翻页，仿佛在读的不是文字，而是窗外的雨。在这里，人们似乎暂时放下了白天的匆忙，愿意为一本书停留很久，也愿意为一个句子停下来想一想。我常常想，一座城市是否值得居住，或许就看它在深夜里，还留不留着这样一盏为读书人亮着的灯。"),
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
