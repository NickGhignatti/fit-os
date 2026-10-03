package com.nickghignatti.tracker.domain.fake

import com.nickghignatti.tracker.domain.model.Equipment
import com.nickghignatti.tracker.domain.model.ExerciseCategory
import com.nickghignatti.tracker.domain.model.ExerciseFilter
import com.nickghignatti.tracker.domain.model.ExerciseInfo
import com.nickghignatti.tracker.domain.model.ExerciseLevel
import com.nickghignatti.tracker.domain.model.Muscle
import com.nickghignatti.tracker.domain.model.TextSearch
import com.nickghignatti.tracker.domain.repository.ExerciseCatalogRepository

/** A catalogue exercise for tests. */
fun catalogExercise(
    id: String,
    name: String,
    muscle: Muscle = Muscle.CHEST,
    equipment: Equipment? = Equipment.BARBELL,
) = ExerciseInfo(
    id = id,
    name = name,
    category = ExerciseCategory.STRENGTH,
    level = ExerciseLevel.BEGINNER,
    equipment = equipment,
    primaryMuscles = listOf(muscle),
    secondaryMuscles = emptyList(),
    instructions = listOf("Do it."),
    imageUrls = emptyList(),
)

/** In-memory [ExerciseCatalogRepository] over a fixed list. */
class FakeExerciseCatalogRepository(private val exercises: List<ExerciseInfo> = emptyList()) : ExerciseCatalogRepository {
    override suspend fun search(query: String, filter: ExerciseFilter): List<ExerciseInfo> {
        val matching = exercises.filter(filter::matches)
        return if (query.isBlank()) matching.sortedBy { it.name } else TextSearch.rank(query, matching) { it.name }
    }

    override suspend fun get(id: String): ExerciseInfo? = exercises.find { it.id == id }
}
