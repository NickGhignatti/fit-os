package com.nickghignatti.tracker.domain.model

import java.text.Normalizer

/**
 * Matches food names against what the user typed, the way people search in Italian: case and
 * accents are ignored, every typed word must start a word of the name, a final vowel is dropped
 * so singular and plural meet ("mela" finds "Mele"), and linking words are skipped because names
 * are written differently ("petto di pollo" finds "Pollo, petto").
 */
object FoodSearch {
    private const val MIN_STEM_LENGTH = 4
    private val VOWELS = setOf('a', 'e', 'i', 'o', 'u')
    private val WORD_SEPARATORS = Regex("[^\\p{L}\\p{N}]+")
    private val DIACRITICS = Regex("\\p{Mn}+")
    private val LINKING_WORDS = setOf(
        "di", "del", "della", "dei", "delle", "al", "alla", "allo", "ai", "alle", "con", "e", "in", "da", "per",
        "il", "lo", "la", "i", "gli", "le", "un", "una", "a",
    )

    /** [items] whose name matches [query], best first: a match on the first word, then shorter names. */
    fun <T> rank(query: String, items: List<T>, name: (T) -> String): List<T> {
        val typed = words(query)
        val stems = (typed.filterNot { it in LINKING_WORDS }.ifEmpty { typed }).map(::stem)
        if (stems.isEmpty()) return emptyList()
        return items
            .mapNotNull { item ->
                val nameWords = words(name(item))
                if (stems.all { stem -> nameWords.any { it.startsWith(stem) } }) item to nameWords else null
            }
            .sortedWith(
                compareByDescending<Pair<T, List<String>>> { (_, nameWords) -> nameWords.first().startsWith(stems.first()) }
                    .thenBy { (_, nameWords) -> nameWords.size }
                    .thenBy { (item, _) -> name(item).length },
            )
            .map { it.first }
    }

    private fun words(text: String): List<String> =
        Normalizer.normalize(text.lowercase(), Normalizer.Form.NFD)
            .replace(DIACRITICS, "")
            .split(WORD_SEPARATORS)
            .filter { it.isNotEmpty() }

    private fun stem(word: String): String =
        if (word.length >= MIN_STEM_LENGTH && word.last() in VOWELS) word.dropLast(1) else word
}
