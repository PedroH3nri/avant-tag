/**
 * Os textos fixos do aviso de adblock, nas 15 línguas da g-tag (`src/tag/loader/translator.ts`),
 * com o "continuar assim" do aviso que deixa fechar. Inglês é o padrão.
 */

export interface AdblockTexts {
  title: string
  text: string
  detail: string
  strong: string
  detailEnd: string
  hint: string
  button: string
  skip: string
}

/** Monta os textos; ``detail`` + ``strong`` (em negrito) + ``detailEnd`` formam a segunda frase. */
function texts(
  title: string,
  text: string,
  detail: [string, string, string],
  hint: string,
  button: string,
  skip: string,
): AdblockTexts {
  const [start, strong, end] = detail
  return { title, text, detail: start, strong, detailEnd: end, hint, button, skip }
}

export const ADBLOCK_TEXTS: Record<string, AdblockTexts> = {
  en: texts(
    'Support free content',
    'Our site is supported by responsible ads that help us create and maintain quality content at no cost to you.',
    ['We detected an active ad blocker in your browser. To continue, please disable the blocker ', 'only for this site', '.'],
    'This does not affect other websites and can be reversed at any time.',
    'I’ve disabled it — continue',
    'Continue anyway',
  ),
  pt: texts(
    'Apoie o conteúdo gratuito',
    'Nosso site é mantido por anúncios responsáveis, que nos ajudam a criar e manter conteúdos de qualidade, sem custo para você.',
    ['Identificamos um bloqueio de anúncios ativo no seu navegador. Para continuar, pedimos que desative o bloqueador ', 'apenas neste site', '.'],
    'Isso não interfere em outros sites e pode ser revertido a qualquer momento.',
    'Já desativei, quero continuar',
    'Continuar assim',
  ),
  es: texts(
    'Apoya el contenido gratuito',
    'Nuestro sitio se mantiene gracias a anuncios responsables, que nos ayudan a crear y mantener contenidos de calidad sin costo para ti.',
    ['Hemos detectado un bloqueador de anuncios activo en tu navegador. Para continuar, te pedimos que desactives el bloqueador ', 'solo para este sitio', '.'],
    'Esto no afecta a otros sitios web y se puede revertir en cualquier momento.',
    'Ya lo desactivé, quiero continuar',
    'Continuar así',
  ),
  fr: texts(
    'Soutenez le contenu gratuit',
    'Notre site est soutenu par des publicités responsables, qui nous aident à créer et à maintenir un contenu de qualité, sans frais pour vous.',
    ['Nous avons détecté un bloqueur de publicités actif sur votre navigateur. Pour continuer, veuillez désactiver le bloqueur ', 'uniquement pour ce site', '.'],
    'Cela n’affecte pas les autres sites et peut être annulé à tout moment.',
    'Je l’ai désactivé, continuer',
    'Continuer quand même',
  ),
  it: texts(
    'Sostieni i contenuti gratuiti',
    'Il nostro sito è supportato da annunci responsabili, che ci aiutano a creare e mantenere contenuti di qualità senza alcun costo per te.',
    ['Abbiamo rilevato un blocco degli annunci attivo nel tuo browser. Per continuare, ti chiediamo di disattivare il blocco ', 'solo per questo sito', '.'],
    'Questo non influisce su altri siti e può essere annullato in qualsiasi momento.',
    'L’ho disattivato, continua',
    'Continua comunque',
  ),
  de: texts(
    'Unterstützen Sie kostenlose Inhalte',
    'Unsere Website wird durch verantwortungsvolle Werbung unterstützt, die uns hilft, hochwertige Inhalte kostenlos bereitzustellen.',
    ['Wir haben einen aktiven Werbeblocker in Ihrem Browser erkannt. Um fortzufahren, deaktivieren Sie den Blocker bitte ', 'nur für diese Website', '.'],
    'Dies betrifft keine anderen Websites und kann jederzeit rückgängig gemacht werden.',
    'Ich habe es deaktiviert, weiter',
    'Trotzdem fortfahren',
  ),
  nl: texts(
    'Steun gratis inhoud',
    'Onze site wordt ondersteund door verantwoorde advertenties, die ons helpen kwalitatieve content te creëren en te onderhouden, zonder kosten voor jou.',
    ['We hebben een actieve advertentieblokker in je browser gedetecteerd. Om verder te gaan, vragen we je de blokkering ', 'alleen voor deze website', ' uit te schakelen.'],
    'Dit heeft geen invloed op andere websites en kan op elk moment worden teruggedraaid.',
    'Ik heb het uitgeschakeld, doorgaan',
    'Toch doorgaan',
  ),
  ru: texts(
    'Поддержите бесплатный контент',
    'Наш сайт поддерживается ответственными объявлениями, которые помогают нам создавать и поддерживать качественный контент без каких-либо затрат для вас.',
    ['Мы обнаружили активный блокировщик рекламы в вашем браузере. Чтобы продолжить, пожалуйста, отключите блокировщик ', 'только для этого сайта', '.'],
    'Это не влияет на другие сайты и может быть отменено в любой момент.',
    'Я отключил блокировку, продолжить',
    'Продолжить без отключения',
  ),
  ja: texts(
    '無料コンテンツを支援してください',
    '当サイトは、質の高いコンテンツを無料で提供し続けるため、適切な広告によって運営されています。',
    ['お使いのブラウザで広告ブロッカーが有効になっていることを検出しました。続行するには、', 'このサイトのみ', 'でブロッカーを無効にしてください。'],
    'これは他のサイトには影響せず、いつでも元に戻すことができます。',
    '無効にしました。続行する',
    'このまま続ける',
  ),
  zh: texts(
    '支持免费内容',
    '我们的网站通过合理的广告来支持，这些广告帮助我们免费提供高质量的内容。',
    ['我们检测到您的浏览器启用了广告拦截功能。若要继续，请仅在', '本网站', '上关闭广告拦截。'],
    '这不会影响其他网站，并且可以随时恢复。',
    '我已关闭，继续',
    '仍然继续',
  ),
  ar: texts(
    'ادعم المحتوى المجاني',
    'يتم دعم موقعنا من خلال إعلانات مسؤولة تساعدنا على إنشاء والحفاظ على محتوى عالي الجودة دون أي تكلفة عليك.',
    ['اكتشفنا وجود مانع للإعلانات مفعّل على متصفحك. للمتابعة، نرجو منك تعطيل المانع ', 'لهذا الموقع فقط', '.'],
    'لن يؤثر هذا على المواقع الأخرى ويمكن التراجع عنه في أي وقت.',
    'لقد قمت بإيقافه، متابعة',
    'المتابعة على أي حال',
  ),
  ko: texts(
    '무료 콘텐츠를 지원하세요',
    '저희 사이트는 책임 있는 광고를 통해 운영되며, 이를 통해 무료로 양질의 콘텐츠를 제공할 수 있습니다.',
    ['브라우저에서 광고 차단기가 활성화되어 있는 것을 감지했습니다. 계속하려면 ', '이 사이트에서만', ' 차단을 해제해 주세요.'],
    '이는 다른 웹사이트에는 영향을 미치지 않으며 언제든지 되돌릴 수 있습니다.',
    '비활성화했습니다. 계속하기',
    '그냥 계속하기',
  ),
  tr: texts(
    'Ücretsiz içeriği destekleyin',
    'Sitemiz, kaliteli içerikleri size ücretsiz sunmamıza yardımcı olan sorumlu reklamlar sayesinde ayakta durmaktadır.',
    ['Tarayıcınızda etkin bir reklam engelleyici tespit ettik. Devam etmek için engelleyiciyi ', 'yalnızca bu site için', ' devre dışı bırakmanızı rica ederiz.'],
    'Bu, diğer siteleri etkilemez ve istediğiniz zaman geri alınabilir.',
    'Devre dışı bıraktım, devam et',
    'Yine de devam et',
  ),
  pl: texts(
    'Wspieraj darmowe treści',
    'Nasza strona jest wspierana przez odpowiedzialne reklamy, które pomagają nam tworzyć i utrzymywać treści wysokiej jakości bez kosztów dla Ciebie.',
    ['Wykryliśmy aktywny bloker reklam w Twojej przeglądarce. Aby kontynuować, prosimy o wyłączenie blokady ', 'tylko dla tej strony', '.'],
    'Nie wpływa to na inne strony i można to cofnąć w dowolnym momencie.',
    'Wyłączyłem, kontynuuj',
    'Kontynuuj mimo to',
  ),
  sv: texts(
    'Stöd gratis innehåll',
    'Vår webbplats stöds av ansvarsfull annonsering som hjälper oss att skapa och underhålla innehåll av hög kvalitet, helt utan kostnad för dig.',
    ['Vi har upptäckt en aktiv annonsblockerare i din webbläsare. För att fortsätta ber vi dig att inaktivera blockeringen ', 'endast för denna webbplats', '.'],
    'Detta påverkar inte andra webbplatser och kan ångras när som helst.',
    'Jag har inaktiverat det, fortsätt',
    'Fortsätt ändå',
  ),
}

export const LOADER_LANGUAGES = Object.keys(ADBLOCK_TEXTS)
export const DEFAULT_LANGUAGE = 'en'

/** Os textos da língua, ou os do inglês. */
export function adblockTexts(language: string): AdblockTexts {
  return ADBLOCK_TEXTS[language] ?? (ADBLOCK_TEXTS[DEFAULT_LANGUAGE] as AdblockTexts)
}
