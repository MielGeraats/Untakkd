import { supabase } from './supabase'
import type { Profile } from './types'

/**
 * Test phase: only the admin (the 'maker' badge) sees and plays De Baapring.
 * To open it up for everyone, set this to true.
 */
export const BAAPRING_FOR_EVERYONE = false
export const canSeeBaapring = (me: Pick<Profile, 'special_badges'> | null | undefined) =>
  BAAPRING_FOR_EVERYONE || Boolean(me?.special_badges?.includes('maker'))

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/** Written by Lars for his BomBomBaap (github.com/LarsvdBrandt/BomBomBaap). */
const LARS: string[] = [
  'Iets zachts', 'Iets keihards', 'Iets belachelijk duurs', 'Iets verdacht goedkoops', 'Iets heel snel', 'Iets heel traag',
  'Iets dat lawaai maakt', 'Iets dat muisstil is', 'Iets zoets', 'Iets zuurs', 'Iets pittigs', 'Iets groens', 'Iets roods',
  'Iets zwarts', 'Iets wits', 'Iets gouds', 'Iets doorzichtigs', 'Iets dat glinstert', 'Iets waar je gegarandeerd over uitglijdt',
  'Iets dat er duur uitziet maar dat niet is', 'Iets dat in je portemonnee past', 'Iets dat je liever niet in je broekzak hebt',
  'Iets dat je verder dan 5 meter kunt trappen', 'Iets dat pijn doet als je erop gaat zitten', 'Iets dat elektrisch is',
  'Iets dat werkt zonder dat iemand weet hoe', 'Iets dat je vroeger cool vond', 'Iets dat alleen oude mensen gebruiken',
  'Iets dat kinderen veel te leuk vinden', 'Iets dat je stiekem verzamelt', 'Iets dat je kwijtraakt als je het nodig hebt',
  'Iets dat je alleen in sprookjes tegenkomt', 'Iets dat je niet mag aanraken', 'Iets dat je absoluut niet mag googelen op werk',
  'Iets dat je alleen per ongeluk tegenkomt', 'Iets dat gevaarlijk is', 'Iets waarbij iemand ooit zei: hold my beer',
  'Iets dat levensgevaarlijk is als het van een lantaarnpaal op je hoofd valt', 'Iets dat je in je eentje kunt tillen',
  'Iets dat je permanent rugschade geeft', 'Iets dat lekker ruikt', 'Iets dat verdacht ruikt', 'Iets dat je gelukkig maakt',
  'Iets dat je meteen spijt geeft', 'Iets dat beter lijkt dan het is',
]

/** Lars's Maastricht mode. */
export const MAASTRICHT: string[] = [
  'Iets typisch Maastrichts', 'Een dispuut uit Maas', 'Een café in Maas', 'Een restaurant in Maas', 'Een henk uit Maas',
  'Een drankje bij de Falstaff', 'Een lekkere chick uit Maas', 'Een huis in Maas', 'Een straatnaam in Maas', 'Een feest in Maas',
  'Een goon die te vaak in de roto staat', 'Een Maas-npc/zwerver', 'Iemand die bij de Falstaff werkt', 'Iemand die bij de Falstaff werkte',
  'Iemand die je hebt geregeld in Maas', 'Een plank uit Maas', 'Iemand met dikke tieten uit Maas', 'Iemand uit Maas die z’n bek moet houden',
  'Een Maastricht-celebrity', 'Een echte sjeng', 'Een alcoholist uit Maas', 'Een drugsverslaafde uit Maas',
]

const GENERAL: string[] = [
  'Een land', 'Een hoofdstad', 'Een stad in Nederland', 'Een automerk', 'Een voetbalclub', 'Een voetballer', 'Een sport',
  'Een muziekinstrument', 'Een Nederlandse artiest', 'Een rapper', 'Een DJ', 'Een beroep', 'Een studie', 'Een meisjesnaam',
  'Een achternaam', 'Een kleur', 'Een emoji', 'Een snoepje', 'Een pizzatopping', 'Iets wat in een tosti kan', 'Een kaassoort',
  'Een cocktail', 'Een biermerk', 'Een snack uit de snackbar', 'Een fastfoodketen', 'Iets wat je in de Action koopt',
  'Iets wat je bij de Albert Heijn koopt', 'Iets in een IKEA', 'Iets in een badkamer', 'Iets op een camping', 'Iets op de kermis',
  'Iets in een ziekenhuis', 'Iets in een gevangenis', 'Iets op een verjaardag', 'Een feestdag', 'Een bordspel', 'Een drankspelletje',
  'Iets met wielen', 'Iets wat vliegt', 'Iets wat zwemt', 'Een insect', 'Een vogel', 'Een boom of bloem', 'Iets van hout',
  'Iets van glas', 'Iets van plastic', 'Iets wat rond is', 'Iets met een batterij', 'Iets wat je kunt opblazen', 'Een gevoel',
  'Een dans', 'Een geluid', 'Een realityshow', 'Een TikTokker of YouTuber', 'Een Disney-film', 'Een tekenfilmfiguur',
  'Iets wat je op een eerste date zegt', 'Een reden om iemand te dumpen', 'Een smoesje als je te laat bent',
  'Iets wat je niet tegen je moeder zegt', 'Iets wat misgaat bij de NS', 'Iets wat je op Marktplaats verkoopt',
  'Iets op je bucketlist', 'Een reden om naar de huisarts te gaan', 'Iets wat je op een festival vindt', 'Een merk',
  'Iets wat je met je handen doet', 'Iets wat je kunt verliezen', 'Iets wat je om 4 uur ’s nachts eet', 'Een excuus om niet naar college te gaan',
  'Iets in een studentenhuis', 'Iets op de vloer van een studentenhuis', 'Een reden om de afwas niet te doen', 'Een tentamenvak dat je gaat herkansen',
  'Een slaapplek als je de laatste trein mist', 'Iets wat je om 3 uur ’s nachts bestelt', 'Iets wat je in een kroeg hoort',
]

const WEED: string[] = [
  'Een strain', 'Iets wat je eet met de munchies', 'Een plek om te blowen', 'Een woord voor stoned', 'Een woord voor een joint',
  'Een stonerfilm of -serie', 'Iets wat je bij je hebt als je gaat blowen', 'Een paranoïde gedachte', 'Iets wat je om 4:20 doet',
  'Een coffeeshopsnack', 'Iets wat je googelt als je high bent', 'Een munchie-combinatie die eigenlijk niet kan',
  'Iets wat je zegt als de politie langskomt', 'Een smoes voor je huisgenoten', 'Iets wat ineens heel grappig is als je stoned bent',
  'Iets wat je beter niet kunt doen als je high bent', 'Iets wat je kwijt bent als je stoned bent', 'Een kleur van een aansteker',
]

// Broad on purpose: "Iets of iemand uit X" works for almost every letter.
const NERD: string[] = [
  'Iets of iemand uit Lord of the Rings of The Hobbit', 'Iets of iemand uit Harry Potter', 'Iets of iemand uit Game of Thrones',
  'Iets of iemand uit Star Wars', 'Iets of iemand uit Dune', 'Iets of iemand uit Marvel of DC', 'Iets of iemand uit Pokémon',
  'Iets of iemand uit een Disney- of Pixarfilm', 'Iets of iemand uit een videogame', 'Iets of iemand uit Minecraft',
  'Iets of iemand uit The Simpsons of Family Guy', 'Iets of iemand uit een tekenfilm van vroeger',
  'Een serie met meer dan 5 seizoenen', 'Een serie op Netflix', 'Een film met een vervolg', 'Een fantasy- of sciencefictionfilm',
  'Een boek dat verfilmd is', 'Een anime', 'Een superkracht', 'Een mythisch wezen', 'Een dinosaurus', 'Een Nintendo-game',
]

export const BUILT_IN: string[] = [...LARS, ...GENERAL, ...WEED, ...NERD]

// ---------------------------------------------------------------------------
// Bonus cards
// ---------------------------------------------------------------------------

export type BonusEffect = 'reverse' | 'skip' | 'half' | 'double'
export type Bonus = { emoji: string; name: string; text: string; effect?: BonusEffect }

export const BONUSES: Bonus[] = [
  { emoji: '🔄', name: 'Omdraaien', text: 'De speelrichting draait om.', effect: 'reverse' },
  { emoji: '⏭️', name: 'Overslaan', text: 'Na jou wordt de volgende speler overgeslagen.', effect: 'skip' },
  { emoji: '⚡', name: 'Snelkookpan', text: 'Je hebt deze beurt maar de helft van de tijd.', effect: 'half' },
  { emoji: '🐢', name: 'Slowmo', text: 'Je krijgt deze beurt dubbel zoveel tijd.', effect: 'double' },
  { emoji: '🤐', name: 'Pantomime', text: 'Je mag je antwoord alleen uitbeelden. Niet praten!' },
  { emoji: '🎤', name: 'Idols', text: 'Je moet je antwoord zingen.' },
  { emoji: '🔤', name: 'Spellingskampioen', text: 'Spel je antwoord letter voor letter.' },
  { emoji: '🐍', name: 'Sisseltong', text: 'Je antwoord moet in een accent naar keuze. Hoe slechter, hoe beter.' },
  { emoji: '🫂', name: 'Hulplijn', text: 'Je mag je linkerbuur om hulp vragen.' },
  { emoji: '🎯', name: 'Sluipschutter', text: 'Bij een goed antwoord wijs je iemand aan die óók een pof neemt.' },
  { emoji: '🧊', name: 'Bevroren', text: 'Niemand behalve jij mag praten tot je beurt voorbij is. Wie praat, neemt een pof.' },
  { emoji: '🪙', name: 'Kop of munt', text: 'Gooi een munt. Kop: dubbele poffen bij goed. Munt: niks extra.' },
  { emoji: '👑', name: 'Koning van de Ring', text: 'Verzin een nieuwe regel die de rest van het spel geldt.' },
  { emoji: '⚔️', name: 'Duel', text: 'Daag iemand uit: wie het eerst een goed woord zegt, wint. Verliezer gaat Jilla.' },
  { emoji: '💍', name: 'De Ene Ring', text: 'Goed antwoord? Dan bepaal jij wie er na jou aan de beurt is.' },
  { emoji: '🧙', name: 'You shall not pass', text: 'Goed antwoord? Dan moet de volgende speler óók een woord uit deze categorie noemen.' },
  { emoji: '🩸', name: 'Rode Bruiloft', text: 'Iedereen die nu in Jilla zit, is meteen weer vrij.' },
  { emoji: '🏜️', name: 'The spice must flow', text: 'Iedereen neemt een pof. Ja, iedereen.' },
  { emoji: '🌌', name: 'Use the Force', text: 'Doe je ogen dicht tijdens je beurt.' },
  { emoji: '🪄', name: 'Expelliarmus', text: 'Wijs iemand aan die zijn telefoon de rest van de ronde moet wegleggen.' },
]

export const BONUS_CHANCE = 1 / 6

// Letters that are fair to start with (no Q, X or Y).
const LETTERS = 'ABCDEFGHIJKLMNOPRSTUVWZ'
export const randomLetter = () => LETTERS[Math.floor(Math.random() * LETTERS.length)]

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

export type Score = { poffen: number; beurten: number; bouncers: number; palindromen: number; jillas: number }
export const EMPTY_SCORE: Score = { poffen: 0, beurten: 0, bouncers: 0, palindromen: 0, jillas: 0 }

/** Lars's ELO formula: start at 100, poffen/bouncers/palindromes add, Jillas cost. Never below 0. */
export const elo = (s: Score) => Math.max(0, 100 + s.poffen * 4.2 + s.bouncers * 4.1 + s.palindromen * 9.9 - s.jillas * 20.4)

export type Career = Score & { games: number; elo: number }

export const addScores = (a: Score, b: Score): Score => ({
  poffen: a.poffen + b.poffen, beurten: a.beurten + b.beurten, bouncers: a.bouncers + b.bouncers,
  palindromen: a.palindromen + b.palindromen, jillas: a.jillas + b.jillas,
})

/** Career totals per user from the saved games. */
export async function fetchCareers(userIds: string[]): Promise<Map<string, Career>> {
  const out = new Map<string, Career>()
  if (!userIds.length) return out
  const { data, error } = await supabase.from('baapring_results')
    .select('user_id, poffen, beurten, bouncers, palindromen, jillas').in('user_id', userIds)
  if (error) throw error
  for (const r of data ?? []) {
    const cur = out.get(r.user_id) ?? { ...EMPTY_SCORE, games: 0, elo: 100 }
    const sum = addScores(cur, r)
    out.set(r.user_id, { ...sum, games: cur.games + 1, elo: elo(sum) })
  }
  return out
}

// ---------------------------------------------------------------------------
// Your group's own categories
// ---------------------------------------------------------------------------

export type CustomCategory = { id: number; text: string; created_by: string; profile: Profile | null }

export async function fetchCustomCategories(): Promise<CustomCategory[]> {
  const { data, error } = await supabase.from('baapring_categories')
    .select('id, text, created_by, profile:profiles!baapring_categories_created_by_fkey(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as CustomCategory[]
}
