package com.nickghignatti.tracker.domain.fake

import com.nickghignatti.tracker.domain.model.DaySummary
import com.nickghignatti.tracker.domain.model.Exercise
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.ExerciseSet
import com.nickghignatti.tracker.domain.model.SetPlan
import com.nickghignatti.tracker.domain.model.Workout
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import java.time.LocalDate
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update

/** In-memory [WorkoutRepository] for tests. */
class FakeWorkoutRepository : WorkoutRepository {
    private var lastId = 0L
    private val state = MutableStateFlow<List<Workout>>(emptyList())

    val workouts: List<Workout> get() = state.value

    override fun observeWorkouts(date: LocalDate): Flow<List<Workout>> =
        state.map { all -> all.filter { it.date == date } }

    override fun observeDaySummaries(from: LocalDate, to: LocalDate): Flow<List<DaySummary>> =
        state.map { all ->
            all.filter { it.date in from..to }
                .groupBy { it.date }
                .map { (date, workouts) -> DaySummary(date, workouts.sumOf { it.totalSets }, workouts.sumOf { it.doneSets }) }
        }

    override suspend fun getWorkouts(date: LocalDate): List<Workout> = state.value.filter { it.date == date }

    override suspend fun getWorkout(id: Long): Workout? = state.value.find { it.id == id }

    override suspend fun createWorkout(date: LocalDate, title: String, exercises: List<ExercisePlan>, planId: Long?): Long {
        val id = nextId()
        state.update { it + Workout(id, date, title, exercises.map(::newExercise), planId) }
        return id
    }

    override suspend fun renameWorkout(id: Long, title: String) =
        state.update { all -> all.map { if (it.id == id) it.copy(title = title) else it } }

    override suspend fun deleteWorkout(id: Long) = state.update { all -> all.filterNot { it.id == id } }

    override suspend fun addExercise(workoutId: Long, exercise: ExercisePlan) =
        state.update { all ->
            all.map { if (it.id == workoutId) it.copy(exercises = it.exercises + newExercise(exercise)) else it }
        }

    override suspend fun updateExercise(id: Long, name: String, notes: String) =
        updateExercises { if (it.id == id) it.copy(name = name, notes = notes) else it }

    override suspend fun deleteExercise(id: Long) =
        state.update { all -> all.map { w -> w.copy(exercises = w.exercises.filterNot { it.id == id }) } }

    override suspend fun addSet(exerciseId: Long, set: SetPlan) =
        updateExercises { if (it.id == exerciseId) it.copy(sets = it.sets + newSet(set)) else it }

    override suspend fun updateSet(set: ExerciseSet) =
        updateExercises { exercise -> exercise.copy(sets = exercise.sets.map { if (it.id == set.id) set else it }) }

    override suspend fun deleteSet(id: Long) =
        updateExercises { exercise -> exercise.copy(sets = exercise.sets.filterNot { it.id == id }) }

    private fun updateExercises(transform: (Exercise) -> Exercise) =
        state.update { all -> all.map { w -> w.copy(exercises = w.exercises.map(transform)) } }

    private fun newExercise(plan: ExercisePlan) = Exercise(nextId(), plan.name, plan.notes, plan.sets.map(::newSet))

    private fun newSet(plan: SetPlan) = ExerciseSet(nextId(), plan.reps, plan.weight)

    private fun nextId() = ++lastId
}
