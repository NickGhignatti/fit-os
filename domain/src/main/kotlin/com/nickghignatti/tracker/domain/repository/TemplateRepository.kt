package com.nickghignatti.tracker.domain.repository

import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.WorkoutTemplate
import kotlinx.coroutines.flow.Flow

interface TemplateRepository {
    /** Templates sorted by name. */
    fun observeTemplates(): Flow<List<WorkoutTemplate>>

    suspend fun getTemplate(id: Long): WorkoutTemplate?

    suspend fun createTemplate(name: String, exercises: List<ExercisePlan>): Long

    suspend fun renameTemplate(id: Long, name: String)

    suspend fun deleteTemplate(id: Long)
}
