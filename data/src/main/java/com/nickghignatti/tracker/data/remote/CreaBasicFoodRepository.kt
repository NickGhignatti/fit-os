package com.nickghignatti.tracker.data.remote

import android.content.Context
import com.nickghignatti.tracker.domain.model.FoodId
import com.nickghignatti.tracker.domain.model.FoodItem
import com.nickghignatti.tracker.domain.model.FoodSearch
import com.nickghignatti.tracker.domain.model.FoodSource
import com.nickghignatti.tracker.domain.model.Nutrients
import com.nickghignatti.tracker.domain.repository.BasicFoodRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * The CREA food composition tables, shipped as an asset (see tools/crea) and kept in memory:
 * under a thousand foods, so searching them directly is instant and works offline.
 */
@Singleton
internal class CreaBasicFoodRepository @Inject constructor(
    @ApplicationContext private val context: Context,
) : BasicFoodRepository {

    private val foods: List<FoodItem> by lazy {
        context.assets.open(ASSET).bufferedReader().useLines { lines -> parseCreaCsv(lines.toList()) }
    }

    override suspend fun search(query: String): List<FoodItem> =
        withContext(Dispatchers.IO) { FoodSearch.rank(query, foods) { it.name } }

    private companion object {
        const val ASSET = "crea_foods.csv"
    }
}

/** Reads the CSV written by tools/crea/extract_crea.py; rows without energy are skipped. */
internal fun parseCreaCsv(lines: List<String>): List<FoodItem> {
    val header = parseCsvLine(lines.firstOrNull() ?: return emptyList())
    val column = header.withIndex().associate { (index, name) -> name to index }
    return lines.drop(1).filter { it.isNotBlank() }.mapNotNull { line ->
        val cells = parseCsvLine(line)
        fun text(name: String) = column[name]?.let(cells::getOrNull).orEmpty()
        fun number(name: String) = text(name).toDoubleOrNull()
        FoodItem(
            id = FoodId(FoodSource.BASIC, text("code")),
            name = text("name"),
            per100g = Nutrients(
                kcal = number("kcal") ?: return@mapNotNull null,
                protein = number("protein_g") ?: 0.0,
                carbs = number("carbs_g") ?: 0.0,
                fat = number("fat_g") ?: 0.0,
            ),
            servingGrams = number("portion_g")?.takeIf { it > 0 },
        )
    }
}

/** One RFC 4180 line: commas separate cells, quotes wrap cells containing commas, "" is a quote. */
internal fun parseCsvLine(line: String): List<String> {
    val cells = mutableListOf<String>()
    val cell = StringBuilder()
    var quoted = false
    var index = 0
    while (index < line.length) {
        val char = line[index]
        when {
            quoted && char == '"' && line.getOrNull(index + 1) == '"' -> { cell.append('"'); index++ }
            char == '"' -> quoted = !quoted
            char == ',' && !quoted -> { cells += cell.toString(); cell.clear() }
            else -> cell.append(char)
        }
        index++
    }
    cells += cell.toString()
    return cells
}
