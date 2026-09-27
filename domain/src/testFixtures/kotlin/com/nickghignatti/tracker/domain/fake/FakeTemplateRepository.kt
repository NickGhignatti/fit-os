package com.nickghignatti.tracker.domain.fake

import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.WorkoutTemplate
import com.nickghignatti.tracker.domain.repository.TemplateRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update

/** In-memory [TemplateRepository] for tests. */
class FakeTemplateRepository : TemplateRepository {
    private var lastId = 0L
    private val state = MutableStateFlow<List<WorkoutTemplate>>(emptyList())

    val templates: List<WorkoutTemplate> get() = state.value

    override fun observeTemplates(): Flow<List<WorkoutTemplate>> =
        state.map { all -> all.sortedBy { it.name.lowercase() } }

    override suspend fun getTemplate(id: Long): WorkoutTemplate? = state.value.find { it.id == id }

    override suspend fun createTemplate(name: String, exercises: List<ExercisePlan>): Long {
        val id = ++lastId
        state.update { it + WorkoutTemplate(id, name, exercises) }
        return id
    }

    override suspend fun renameTemplate(id: Long, name: String) =
        state.update { all -> all.map { if (it.id == id) it.copy(name = name) else it } }

    override suspend fun deleteTemplate(id: Long) = state.update { all -> all.filterNot { it.id == id } }
}
