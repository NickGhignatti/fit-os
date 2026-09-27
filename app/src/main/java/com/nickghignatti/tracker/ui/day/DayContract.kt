package com.nickghignatti.tracker.ui.day

import com.nickghignatti.tracker.domain.model.Exercise
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.ExerciseSet
import com.nickghignatti.tracker.domain.model.Workout
import com.nickghignatti.tracker.domain.model.WorkoutTemplate
import java.time.LocalDate

data class DayUiState(
    val date: LocalDate,
    val isToday: Boolean,
    val workouts: List<Workout> = emptyList(),
    val templates: List<WorkoutTemplate> = emptyList(),
    val isLoading: Boolean = true,
)

sealed interface DayAction {
    data class CreateWorkout(val title: String) : DayAction
    data class ApplyTemplate(val templateId: Long) : DayAction
    data class RenameWorkout(val workoutId: Long, val title: String) : DayAction
    data class DeleteWorkout(val workoutId: Long) : DayAction
    data class CopyWorkout(val workoutId: Long, val target: LocalDate) : DayAction
    data class SaveAsTemplate(val workoutId: Long, val name: String) : DayAction
    data class AddExercise(val workoutId: Long, val exercise: ExercisePlan) : DayAction
    data class UpdateExercise(val exerciseId: Long, val name: String, val notes: String) : DayAction
    data class DeleteExercise(val exerciseId: Long) : DayAction
    data class AddSet(val exercise: Exercise) : DayAction
    data class ToggleSet(val set: ExerciseSet) : DayAction
    data class UpdateSet(val set: ExerciseSet) : DayAction
    data class DeleteSet(val setId: Long) : DayAction
}

/** One-off outcomes the screen confirms with a snackbar. */
sealed interface DayEvent {
    data class WorkoutCopied(val date: LocalDate) : DayEvent
    data class TemplateSaved(val name: String) : DayEvent
}
