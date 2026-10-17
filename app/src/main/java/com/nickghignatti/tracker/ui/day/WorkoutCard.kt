package com.nickghignatti.tracker.ui.day

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.Exercise
import com.nickghignatti.tracker.domain.model.ExerciseSet
import com.nickghignatti.tracker.domain.model.Workout
import com.nickghignatti.tracker.ui.components.CheckTarget
import com.nickghignatti.tracker.ui.components.Hairline
import com.nickghignatti.tracker.ui.components.MenuItem
import com.nickghignatti.tracker.ui.components.OverflowMenu
import com.nickghignatti.tracker.ui.components.ProgressTrack
import com.nickghignatti.tracker.ui.components.TrackerButton
import com.nickghignatti.tracker.ui.components.TrackerCard
import com.nickghignatti.tracker.ui.exercises.HowToButton
import com.nickghignatti.tracker.ui.format.setLabel
import com.nickghignatti.tracker.ui.theme.ButtonKind
import com.nickghignatti.tracker.ui.theme.Tracker
import com.nickghignatti.tracker.ui.theme.TrackerTheme
import java.time.LocalDate

@Composable
internal fun WorkoutCard(
    workout: Workout,
    onOpenDialog: (DayDialog) -> Unit,
    onAction: (DayAction) -> Unit,
    onAddExercise: () -> Unit,
    onOpenExercise: (catalogId: String) -> Unit,
    modifier: Modifier = Modifier,
) {
    TrackerCard(modifier.fillMaxWidth(), contentPadding = PaddingValues(vertical = Tracker.dimens.md)) {
        Row(Modifier.padding(start = Tracker.dimens.lg, end = Tracker.dimens.xs), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(workout.title, style = Tracker.type.headlineMd, color = Tracker.colors.ink)
                if (workout.totalSets > 0) {
                    Text(
                        stringResource(R.string.workout_sets_done, workout.doneSets, workout.totalSets),
                        style = Tracker.type.tabularCaption,
                        color = Tracker.colors.inkSecondary,
                    )
                }
            }
            OverflowMenu(
                listOf(
                    MenuItem(stringResource(R.string.action_rename)) { onOpenDialog(DayDialog.RenameWorkout(workout)) },
                    MenuItem(stringResource(R.string.workout_save_as_plan)) { onOpenDialog(DayDialog.SaveAsPlan(workout)) },
                    MenuItem(stringResource(R.string.workout_copy_to_day)) { onOpenDialog(DayDialog.CopyWorkout(workout)) },
                    MenuItem(stringResource(R.string.action_delete)) { onOpenDialog(DayDialog.DeleteWorkout(workout)) },
                ),
            )
        }
        if (workout.totalSets > 0) {
            ProgressTrack(
                fraction = workout.doneSets.toFloat() / workout.totalSets,
                modifier = Modifier.padding(horizontal = Tracker.dimens.lg, vertical = Tracker.dimens.sm),
            )
        }
        workout.exercises.forEach { exercise ->
            ExerciseBlock(exercise, onOpenDialog, onAction, onOpenExercise)
        }
        Row(Modifier.padding(horizontal = Tracker.dimens.md).padding(top = Tracker.dimens.md)) {
            TrackerButton(
                text = stringResource(R.string.workout_add_exercise),
                onClick = onAddExercise,
                kind = ButtonKind.Secondary,
                icon = R.drawable.ic_add,
                compact = true,
            )
        }
    }
}

@Composable
private fun ExerciseBlock(
    exercise: Exercise,
    onOpenDialog: (DayDialog) -> Unit,
    onAction: (DayAction) -> Unit,
    onOpenExercise: (catalogId: String) -> Unit,
) {
    Column(Modifier.padding(top = Tracker.dimens.sm)) {
        Hairline()
        Row(Modifier.padding(start = Tracker.dimens.lg, end = Tracker.dimens.xs), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f).padding(vertical = Tracker.dimens.sm)) {
                Text(exercise.name, style = Tracker.type.bodyLg, color = Tracker.colors.ink)
                if (exercise.notes.isNotBlank()) {
                    Text(exercise.notes, style = Tracker.type.bodySm, color = Tracker.colors.inkSecondary)
                }
            }
            exercise.catalogId?.let { catalogId -> HowToButton(exercise.name) { onOpenExercise(catalogId) } }
            OverflowMenu(
                listOf(
                    MenuItem(stringResource(R.string.exercise_add_set)) { onAction(DayAction.AddSet(exercise)) },
                    MenuItem(stringResource(R.string.exercise_edit)) { onOpenDialog(DayDialog.EditExercise(exercise)) },
                    MenuItem(stringResource(R.string.action_delete)) { onOpenDialog(DayDialog.DeleteExercise(exercise)) },
                ),
            )
        }
        if (exercise.sets.isEmpty()) {
            Text(
                stringResource(R.string.exercise_no_sets),
                style = Tracker.type.bodyMd,
                color = Tracker.colors.inkSecondary,
                modifier = Modifier.padding(horizontal = Tracker.dimens.lg, vertical = Tracker.dimens.xs),
            )
        }
        exercise.sets.forEachIndexed { index, set ->
            SetRow(
                number = index + 1,
                set = set,
                onToggle = { onAction(DayAction.ToggleSet(set)) },
                onClick = { onOpenDialog(DayDialog.EditSet(set, index + 1)) },
            )
        }
    }
}

@Composable
private fun SetRow(number: Int, set: ExerciseSet, onToggle: () -> Unit, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = Tracker.dimens.rowMinHeight + Tracker.dimens.sm)
            .clickable(onClick = onClick)
            .padding(start = Tracker.dimens.lg, end = Tracker.dimens.lg),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            stringResource(R.string.set_number, number),
            style = Tracker.type.labelSm,
            color = Tracker.colors.inkSecondary,
            modifier = Modifier.width(56.dp),
        )
        Column(Modifier.weight(1f)) {
            Text(setLabel(set.plannedReps, set.plannedWeight), style = Tracker.type.tabularCaption.copy(fontSize = Tracker.type.bodyMd.fontSize), color = Tracker.colors.ink)
            if (set.deviatesFromPlan) {
                Text(
                    stringResource(R.string.set_did, setLabel(set.actualReps ?: set.plannedReps, set.actualWeight)),
                    style = Tracker.type.bodySm,
                    color = Tracker.colors.accent,
                )
            }
        }
        CheckTarget(checked = set.done, onCheckedChange = { onToggle() })
    }
}

@Preview(showBackground = true)
@Composable
private fun WorkoutCardPreview() {
    val bench = Exercise(
        id = 1,
        name = "Bench press",
        notes = "Pause on chest",
        sets = listOf(
            ExerciseSet(id = 1, plannedReps = 10, plannedWeight = 60.0, actualReps = 10, actualWeight = 60.0, done = true),
            ExerciseSet(id = 2, plannedReps = 8, plannedWeight = 65.0, actualReps = 6, actualWeight = 65.0, done = true),
            ExerciseSet(id = 3, plannedReps = 8, plannedWeight = 65.0),
        ),
    )
    TrackerTheme {
        WorkoutCard(
            workout = Workout(1, LocalDate.of(2026, 9, 26), "Push", listOf(bench)),
            onOpenDialog = {},
            onAction = {},
            onAddExercise = {},
            onOpenExercise = {},
        )
    }
}
