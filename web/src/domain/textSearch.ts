/**
 * Matches names of foods and exercises against what the user typed, the way people search in
 * Italian: case and accents are ignored, every typed word must start a word of the name, a final
 * vowel is dropped so singular and plural meet ("mela" finds "Mele"), and linking words are
 * skipped because names are written differently ("petto di pollo" finds "Pollo, petto").
 */
const MIN_STEM_LENGTH = 4;
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const WORD_SEPARATORS = /[^\p{L}\p{N}]+/u;
const DIACRITICS = /\p{Mn}+/gu;
const LINKING_WORDS = new Set([
  'di', 'del', 'della', 'dei', 'delle', 'al', 'alla', 'allo', 'ai', 'alle', 'con', 'e', 'in', 'da', 'per',
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'a',
]);

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .split(WORD_SEPARATORS)
    .filter((w) => w.length > 0);

const stem = (word: string): string =>
  word.length >= MIN_STEM_LENGTH && VOWELS.has(word.at(-1) as string) ? word.slice(0, -1) : word;

/** [items] whose name matches [query], best first: a match on the first word, then shorter names. */
export const rank = <T>(query: string, items: readonly T[], name: (item: T) => string): T[] => {
  const typed = words(query);
  const content = typed.filter((w) => !LINKING_WORDS.has(w));
  const stems = (content.length > 0 ? content : typed).map(stem);
  const first = stems[0];
  if (first === undefined) return [];

  return items
    .flatMap((item) => {
      const nameWords = words(name(item));
      return stems.every((s) => nameWords.some((w) => w.startsWith(s))) ? [{ item, nameWords }] : [];
    })
    .sort((a, b) => {
      const aFirst = a.nameWords[0]?.startsWith(first) ?? false;
      const bFirst = b.nameWords[0]?.startsWith(first) ?? false;
      return (
        Number(bFirst) - Number(aFirst) ||
        a.nameWords.length - b.nameWords.length ||
        name(a.item).length - name(b.item).length
      );
    })
    .map((m) => m.item);
};
