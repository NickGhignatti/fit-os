package com.nickghignatti.tracker.data.remote

import android.content.Context
import com.nickghignatti.tracker.domain.model.Equipment
import com.nickghignatti.tracker.domain.model.ExerciseCategory
import com.nickghignatti.tracker.domain.model.ExerciseFilter
import com.nickghignatti.tracker.domain.model.ExerciseInfo
import com.nickghignatti.tracker.domain.model.ExerciseLevel
import com.nickghignatti.tracker.domain.model.Muscle
import com.nickghignatti.tracker.domain.model.TextSearch
import com.nickghignatti.tracker.domain.repository.ExerciseCatalogRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * The free-exercise-db catalogue (public domain), shipped as an asset (see tools/exercises) and
 * kept in memory. Its photos are not bundled: their URLs point at the same pinned commit.
 */
@Singleton
internal class FreeExerciseDbRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val json: Json,
) : ExerciseCatalogRepository {

    private val exercises: List<ExerciseInfo> by lazy {
        val text = context.assets.open(ASSET).bufferedReader().use { it.readText() }
        parseExerciseCatalog(json, text)
    }

    override suspend fun search(query: String, filter: ExerciseFilter): List<ExerciseInfo> = withContext(Dispatchers.IO) {
        val matching = exercises.filter(filter::matches)
        if (query.isBlank()) matching else TextSearch.rank(query, matching) { it.name }
    }

    override suspend fun get(id: String): ExerciseInfo? = withContext(Dispatchers.IO) { exercises.find { it.id == id } }

    private companion object {
        const val ASSET = "exercises.json"
    }
}

/** Must match the commit in tools/exercises/fetch_exercises.py. */
private const val IMAGE_BASE_URL =
    "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/"

/** Sorted by name; values the app does not know are dropped rather than failing the whole list. */
internal fun parseExerciseCatalog(json: Json, text: String): List<ExerciseInfo> =
    json.decodeFromString<List<ExerciseDto>>(text)
        .mapNotNull { it.toDomain() }
        .sortedBy { it.name.lowercase() }

@Serializable
private class ExerciseDto(
    val id: String,
    val name: String,
    val category: String? = null,
    val level: String? = null,
    val equipment: String? = null,
    val primaryMuscles: List<String> = emptyList(),
    val secondaryMuscles: List<String> = emptyList(),
    val instructions: List<String> = emptyList(),
    val images: List<String> = emptyList(),
) {
    fun toDomain(): ExerciseInfo? = ExerciseInfo(
        id = id,
        name = name.trim(),
        category = enumOf<ExerciseCategory>(category) ?: return null,
        level = enumOf<ExerciseLevel>(level) ?: ExerciseLevel.BEGINNER,
        equipment = enumOf<Equipment>(equipment),
        primaryMuscles = primaryMuscles.mapNotNull { enumOf<Muscle>(it) },
        secondaryMuscles = secondaryMuscles.mapNotNull { enumOf<Muscle>(it) },
        instructions = instructions.map(String::trim).filter(String::isNotEmpty),
        imageUrls = images.map { IMAGE_BASE_URL + it },
    )
}

/** The catalogue writes "lower back", "e-z curl bar", "olympic weightlifting": map them to enum names. */
private inline fun <reified E : Enum<E>> enumOf(value: String?): E? {
    val name = value?.uppercase()?.replace(Regex("[^A-Z]+"), "_") ?: return null
    return enumValues<E>().find { it.name == name }
}
