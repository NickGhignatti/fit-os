package com.nickghignatti.tracker.domain.repository

import com.nickghignatti.tracker.domain.model.ExerciseFilter
import com.nickghignatti.tracker.domain.model.ExerciseInfo

/** The bundled exercise catalogue, available offline. */
interface ExerciseCatalogRepository {
    /** Exercises matching [query] and [filter], best first; a blank query lists all matches by name. */
    suspend fun search(query: String, filter: ExerciseFilter = ExerciseFilter()): List<ExerciseInfo>

    suspend fun get(id: String): ExerciseInfo?
}
