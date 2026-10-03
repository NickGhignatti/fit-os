package com.nickghignatti.tracker.data.repository

import androidx.room.withTransaction
import com.nickghignatti.tracker.data.local.AppDatabase
import com.nickghignatti.tracker.data.local.ExerciseEntity
import com.nickghignatti.tracker.data.local.SetEntity
import com.nickghignatti.tracker.data.local.WorkoutEntity
import com.nickghignatti.tracker.data.mapper.toDomain
import com.nickghignatti.tracker.domain.model.DaySummary
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.ExerciseSet
import com.nickghignatti.tracker.domain.model.SetPlan
import com.nickghignatti.tracker.domain.model.Workout
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

internal class RoomWorkoutRepository @Inject constructor(
    private val db: AppDatabase,
) : WorkoutRepository {
    private val dao = db.workoutDao()

    override fun observeWorkouts(date: LocalDate): Flow<List<Workout>> =
        dao.observeWorkoutsOn(date).map { rows -> rows.map { it.toDomain() } }

    override fun observeDaySummaries(from: LocalDate, to: LocalDate): Flow<List<DaySummary>> =
        dao.observeDaySummaries(from, to).map { rows -> rows.map { it.toDomain() } }

    override suspend fun getWorkouts(date: LocalDate): List<Workout> = dao.getWorkoutsOn(date).map { it.toDomain() }

    override suspend fun getWorkout(id: Long): Workout? = dao.getWorkout(id)?.toDomain()

    override suspend fun createWorkout(date: LocalDate, title: String, exercises: List<ExercisePlan>, planId: Long?): Long =
        db.withTransaction {
            val workoutId = dao.insertWorkout(WorkoutEntity(date = date, title = title, planId = planId))
            exercises.forEachIndexed { position, exercise -> insertExercise(workoutId, position, exercise) }
            workoutId
        }

    override suspend fun renameWorkout(id: Long, title: String) = dao.renameWorkout(id, title)

    override suspend fun deleteWorkout(id: Long) = dao.deleteWorkout(id)

    override suspend fun addExercise(workoutId: Long, exercise: ExercisePlan) = db.withTransaction {
        insertExercise(workoutId, dao.nextExercisePosition(workoutId), exercise)
    }

    override suspend fun updateExercise(id: Long, name: String, notes: String) = dao.updateExercise(id, name, notes)

    override suspend fun deleteExercise(id: Long) = dao.deleteExercise(id)

    override suspend fun addSet(exerciseId: Long, set: SetPlan) = db.withTransaction {
        dao.insertSets(listOf(set.toEntity(exerciseId, dao.nextSetPosition(exerciseId))))
    }

    override suspend fun updateSet(set: ExerciseSet) = dao.updateSet(
        id = set.id,
        plannedReps = set.plannedReps,
        plannedWeight = set.plannedWeight,
        actualReps = set.actualReps,
        actualWeight = set.actualWeight,
        done = set.done,
    )

    override suspend fun deleteSet(id: Long) = dao.deleteSet(id)

    /** Callers must hold a transaction. */
    private suspend fun insertExercise(workoutId: Long, position: Int, exercise: ExercisePlan) {
        val exerciseId = dao.insertExercise(
            ExerciseEntity(
                workoutId = workoutId,
                position = position,
                name = exercise.name,
                notes = exercise.notes,
                catalogId = exercise.catalogId,
            ),
        )
        dao.insertSets(exercise.sets.mapIndexed { index, set -> set.toEntity(exerciseId, index) })
    }

    private fun SetPlan.toEntity(exerciseId: Long, position: Int) =
        SetEntity(exerciseId = exerciseId, position = position, plannedReps = reps, plannedWeight = weight)
}
