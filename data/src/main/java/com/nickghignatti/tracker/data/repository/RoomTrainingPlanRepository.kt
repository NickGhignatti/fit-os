package com.nickghignatti.tracker.data.repository

import androidx.room.withTransaction
import com.nickghignatti.tracker.data.local.AppDatabase
import com.nickghignatti.tracker.data.local.PlanExerciseEntity
import com.nickghignatti.tracker.data.local.PlanSetEntity
import com.nickghignatti.tracker.data.local.TrainingPlanEntity
import com.nickghignatti.tracker.data.mapper.toDomain
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.model.SetPlan
import com.nickghignatti.tracker.domain.model.TrainingPlan
import com.nickghignatti.tracker.domain.repository.TrainingPlanRepository
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

internal class RoomTrainingPlanRepository @Inject constructor(
    private val db: AppDatabase,
) : TrainingPlanRepository {
    private val dao = db.trainingPlanDao()

    override fun observePlans(): Flow<List<TrainingPlan>> = dao.observePlans().map { rows -> rows.map { it.toDomain() } }

    override fun observePlan(id: Long): Flow<TrainingPlan?> = dao.observePlan(id).map { it?.toDomain() }

    override fun observeActivePlan(): Flow<TrainingPlan?> = dao.observeActivePlan().map { it?.toDomain() }

    override suspend fun getActivePlan(): TrainingPlan? = dao.getActivePlan()?.toDomain()

    override suspend fun createPlan(name: String, recurrence: Recurrence): Long = createPlan(name, recurrence, emptyMap())

    override suspend fun createPlan(
        name: String,
        recurrence: Recurrence,
        sessions: Map<PlanDay, List<ExercisePlan>>,
    ): Long = db.withTransaction {
        val planId = dao.insertPlan(TrainingPlanEntity(name = name, recurrence = recurrence))
        sessions.forEach { (day, exercises) ->
            exercises.forEachIndexed { position, exercise -> insertExercise(planId, day, position, exercise) }
        }
        planId
    }

    override suspend fun renamePlan(id: Long, name: String) = dao.renamePlan(id, name)

    override suspend fun deletePlan(id: Long) = dao.deletePlan(id)

    override suspend fun setActivePlan(id: Long?) = dao.setActivePlan(id)

    override suspend fun addExercise(planId: Long, day: PlanDay, exercise: ExercisePlan) = db.withTransaction {
        insertExercise(planId, day, dao.nextExercisePosition(planId, day), exercise)
    }

    override suspend fun updateExercise(id: Long, name: String, notes: String) = dao.updateExercise(id, name, notes)

    override suspend fun deleteExercise(id: Long) = dao.deleteExercise(id)

    override suspend fun addSet(exerciseId: Long, set: SetPlan) = db.withTransaction {
        dao.insertSets(listOf(set.toEntity(exerciseId, dao.nextSetPosition(exerciseId))))
    }

    override suspend fun updateSet(id: Long, set: SetPlan) = dao.updateSet(id, set.reps, set.weight)

    override suspend fun deleteSet(id: Long) = dao.deleteSet(id)

    /** Callers must hold a transaction. */
    private suspend fun insertExercise(planId: Long, day: PlanDay, position: Int, exercise: ExercisePlan) {
        val exerciseId = dao.insertExercise(
            PlanExerciseEntity(planId = planId, day = day, position = position, name = exercise.name, notes = exercise.notes),
        )
        dao.insertSets(exercise.sets.mapIndexed { index, set -> set.toEntity(exerciseId, index) })
    }

    private fun SetPlan.toEntity(exerciseId: Long, position: Int) =
        PlanSetEntity(exerciseId = exerciseId, position = position, reps = reps, weight = weight)
}
