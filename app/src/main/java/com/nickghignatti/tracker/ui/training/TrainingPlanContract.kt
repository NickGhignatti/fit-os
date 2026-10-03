package com.nickghignatti.tracker.ui.training

import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.PlannedExercise
import com.nickghignatti.tracker.domain.model.SetPlan
import com.nickghignatti.tracker.domain.model.TrainingPlan
import java.time.DayOfWeek

data class TrainingPlanUiState(
    val selectedDay: DayOfWeek,
    val today: DayOfWeek,
    /** Null while loading, or once the plan has been deleted. */
    val plan: TrainingPlan? = null,
    val isLoading: Boolean = true,
) {
    /** The part being edited: the only one of a daily plan, or the selected weekday. */
    val planDay: PlanDay? get() = plan?.recurrence?.dayOf(selectedDay)

    val exercises: List<PlannedExercise> get() = planDay?.let { plan?.sessionOn(it) }.orEmpty()
}

sealed interface TrainingPlanAction {
    data class SelectDay(val day: DayOfWeek) : TrainingPlanAction
    data class UpdateExercise(val exerciseId: Long, val name: String, val notes: String) : TrainingPlanAction
    data class DeleteExercise(val exerciseId: Long) : TrainingPlanAction
    data class AddSet(val exercise: PlannedExercise) : TrainingPlanAction
    data class UpdateSet(val setId: Long, val set: SetPlan) : TrainingPlanAction
    data class DeleteSet(val setId: Long) : TrainingPlanAction
}
