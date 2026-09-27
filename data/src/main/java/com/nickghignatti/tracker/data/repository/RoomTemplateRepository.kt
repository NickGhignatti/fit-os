package com.nickghignatti.tracker.data.repository

import androidx.room.withTransaction
import com.nickghignatti.tracker.data.local.AppDatabase
import com.nickghignatti.tracker.data.local.TemplateEntity
import com.nickghignatti.tracker.data.local.TemplateExerciseEntity
import com.nickghignatti.tracker.data.local.TemplateSetEntity
import com.nickghignatti.tracker.data.mapper.toDomain
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.WorkoutTemplate
import com.nickghignatti.tracker.domain.repository.TemplateRepository
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

internal class RoomTemplateRepository @Inject constructor(
    private val db: AppDatabase,
) : TemplateRepository {
    private val dao = db.templateDao()

    override fun observeTemplates(): Flow<List<WorkoutTemplate>> =
        dao.observeTemplates().map { rows -> rows.map { it.toDomain() } }

    override suspend fun getTemplate(id: Long): WorkoutTemplate? = dao.getTemplate(id)?.toDomain()

    override suspend fun createTemplate(name: String, exercises: List<ExercisePlan>): Long = db.withTransaction {
        val templateId = dao.insertTemplate(TemplateEntity(name = name))
        exercises.forEachIndexed { position, exercise ->
            val exerciseId = dao.insertExercise(
                TemplateExerciseEntity(
                    templateId = templateId,
                    position = position,
                    name = exercise.name,
                    notes = exercise.notes,
                ),
            )
            dao.insertSets(
                exercise.sets.mapIndexed { index, set ->
                    TemplateSetEntity(templateExerciseId = exerciseId, position = index, reps = set.reps, weight = set.weight)
                },
            )
        }
        templateId
    }

    override suspend fun renameTemplate(id: Long, name: String) = dao.renameTemplate(id, name)

    override suspend fun deleteTemplate(id: Long) = dao.deleteTemplate(id)
}
