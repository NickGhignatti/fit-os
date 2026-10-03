package com.nickghignatti.tracker.domain.fake

import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.PlannedExercise
import com.nickghignatti.tracker.domain.model.PlannedSet
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.model.SetPlan
import com.nickghignatti.tracker.domain.model.TrainingPlan
import com.nickghignatti.tracker.domain.repository.TrainingPlanRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update

/** In-memory [TrainingPlanRepository] for tests. */
class FakeTrainingPlanRepository : TrainingPlanRepository {
    private var lastId = 0L
    private val state = MutableStateFlow<List<TrainingPlan>>(emptyList())

    val plans: List<TrainingPlan> get() = state.value

    fun plan(id: Long): TrainingPlan = state.value.single { it.id == id }

    override fun observePlans(): Flow<List<TrainingPlan>> = state.map { all -> all.sortedBy { it.name.lowercase() } }

    override fun observePlan(id: Long): Flow<TrainingPlan?> = state.map { all -> all.find { it.id == id } }

    override fun observeActivePlan(): Flow<TrainingPlan?> = state.map { all -> all.find { it.isActive } }

    override suspend fun getActivePlan(): TrainingPlan? = state.value.find { it.isActive }

    override suspend fun createPlan(name: String, recurrence: Recurrence): Long = createPlan(name, recurrence, emptyMap())

    override suspend fun createPlan(
        name: String,
        recurrence: Recurrence,
        sessions: Map<PlanDay, List<ExercisePlan>>,
    ): Long {
        val id = nextId()
        state.update { it + TrainingPlan(id, name, recurrence, sessions = sessions.mapValues { (_, list) -> list.map(::newExercise) }) }
        return id
    }

    override suspend fun renamePlan(id: Long, name: String) = updatePlan(id) { it.copy(name = name) }

    override suspend fun deletePlan(id: Long) = state.update { all -> all.filterNot { it.id == id } }

    override suspend fun setActivePlan(id: Long?) = state.update { all -> all.map { it.copy(isActive = it.id == id) } }

    override suspend fun addExercise(planId: Long, day: PlanDay, exercise: ExercisePlan) = updatePlan(planId) { plan ->
        plan.copy(sessions = plan.sessions + (day to plan.sessionOn(day) + newExercise(exercise)))
    }

    override suspend fun updateExercise(id: Long, name: String, notes: String) =
        updateExercises { if (it.id == id) it.copy(name = name, notes = notes) else it }

    override suspend fun deleteExercise(id: Long) = state.update { all ->
        all.map { plan -> plan.copy(sessions = plan.sessions.mapValues { (_, list) -> list.filterNot { it.id == id } }) }
    }

    override suspend fun addSet(exerciseId: Long, set: SetPlan) =
        updateExercises { if (it.id == exerciseId) it.copy(sets = it.sets + newSet(set)) else it }

    override suspend fun updateSet(id: Long, set: SetPlan) = updateExercises { exercise ->
        exercise.copy(sets = exercise.sets.map { if (it.id == id) it.copy(reps = set.reps, weight = set.weight) else it })
    }

    override suspend fun deleteSet(id: Long) =
        updateExercises { exercise -> exercise.copy(sets = exercise.sets.filterNot { it.id == id }) }

    private fun updatePlan(id: Long, transform: (TrainingPlan) -> TrainingPlan) =
        state.update { all -> all.map { if (it.id == id) transform(it) else it } }

    private fun updateExercises(transform: (PlannedExercise) -> PlannedExercise) = state.update { all ->
        all.map { plan -> plan.copy(sessions = plan.sessions.mapValues { (_, list) -> list.map(transform) }) }
    }

    private fun newExercise(plan: ExercisePlan) = PlannedExercise(nextId(), plan.name, plan.notes, plan.sets.map(::newSet), plan.catalogId)

    private fun newSet(plan: SetPlan) = PlannedSet(nextId(), plan.reps, plan.weight)

    private fun nextId() = ++lastId
}
