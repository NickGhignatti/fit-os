@file:OptIn(ExperimentalMaterial3Api::class)

package com.nickghignatti.tracker.ui.day

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.ui.theme.Tracker
import com.nickghignatti.tracker.ui.components.TrackerFab
import com.nickghignatti.tracker.ui.components.TrackerTopBar
import com.nickghignatti.tracker.ui.components.TrackerBackButton
import com.nickghignatti.tracker.domain.model.Exercise
import com.nickghignatti.tracker.domain.model.ExerciseSet
import com.nickghignatti.tracker.domain.model.Workout
import com.nickghignatti.tracker.ui.components.ConfirmDeleteDialog
import com.nickghignatti.tracker.ui.components.DatePickerModal
import com.nickghignatti.tracker.ui.components.EditExerciseDialog
import com.nickghignatti.tracker.ui.components.EmptyState
import com.nickghignatti.tracker.ui.components.TextInputDialog
import com.nickghignatti.tracker.ui.format.displayName
import com.nickghignatti.tracker.ui.format.formatted
import java.time.format.FormatStyle

/** Which dialog is open; transient UI state, so it lives in the screen, not the ViewModel. */
internal sealed interface DayDialog {
    data object NewWorkout : DayDialog
    data class RenameWorkout(val workout: Workout) : DayDialog
    data class SaveAsPlan(val workout: Workout) : DayDialog
    data class CopyWorkout(val workout: Workout) : DayDialog
    data class DeleteWorkout(val workout: Workout) : DayDialog
    data class EditExercise(val exercise: Exercise) : DayDialog
    data class DeleteExercise(val exercise: Exercise) : DayDialog
    data class EditSet(val set: ExerciseSet, val number: Int) : DayDialog
}

@Composable
fun DayScreen(
    onBack: () -> Unit,
    onAddExercise: (workoutId: Long) -> Unit,
    onOpenExercise: (catalogId: String) -> Unit,
    viewModel: DayViewModel,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    val resources = LocalResources.current

    LaunchedEffect(viewModel) {
        viewModel.events.collect { event ->
            val message = when (event) {
                is DayEvent.WorkoutCopied -> resources.getString(R.string.day_workout_copied, event.date.formatted(FormatStyle.MEDIUM))
                is DayEvent.PlanSaved -> resources.getString(R.string.day_plan_saved, event.name)
            }
            snackbar.showSnackbar(message)
        }
    }

    DayScreen(state, viewModel::onAction, onBack, onAddExercise, onOpenExercise, snackbar)
}

@Composable
internal fun DayScreen(
    state: DayUiState,
    onAction: (DayAction) -> Unit,
    onBack: () -> Unit,
    onAddExercise: (workoutId: Long) -> Unit = {},
    onOpenExercise: (catalogId: String) -> Unit = {},
    snackbar: SnackbarHostState = remember { SnackbarHostState() },
) {
    var dialog by remember { mutableStateOf<DayDialog?>(null) }

    Scaffold(
        topBar = {
            TrackerTopBar(
                title = if (state.isToday) stringResource(R.string.day_today) else state.date.dayOfWeek.displayName(),
                subtitle = state.date.formatted(FormatStyle.LONG),
                navigation = { TrackerBackButton(onBack) },
            )
        },
        floatingActionButton = {
            TrackerFab(stringResource(R.string.day_add_workout), onClick = { dialog = DayDialog.NewWorkout })
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        when {
            state.isLoading -> Unit
            state.workouts.isEmpty() && state.pendingSession == null ->
                EmptyState(stringResource(R.string.day_empty), Modifier.padding(padding))
            else -> LazyColumn(
                modifier = Modifier.padding(padding),
                contentPadding = PaddingValues(start = Tracker.dimens.pageMargin, top = Tracker.dimens.md, end = Tracker.dimens.pageMargin, bottom = 96.dp),
                verticalArrangement = Arrangement.spacedBy(Tracker.dimens.md),
            ) {
                state.pendingSession?.let { session ->
                    item(key = "pending") {
                        PendingSessionCard(session, onStart = { onAction(DayAction.StartPlannedSession) })
                    }
                }
                items(state.workouts, key = { it.id }) { workout ->
                    WorkoutCard(
                        workout = workout,
                        onOpenDialog = { dialog = it },
                        onAction = onAction,
                        onAddExercise = { onAddExercise(workout.id) },
                        onOpenExercise = onOpenExercise,
                    )
                }
            }
        }
    }

    dialog?.let { current ->
        DayDialogHost(current, state, onAction, onDismiss = { dialog = null })
    }
}

@Composable
private fun DayDialogHost(
    dialog: DayDialog,
    state: DayUiState,
    onAction: (DayAction) -> Unit,
    onDismiss: () -> Unit,
) {
    val act = { action: DayAction ->
        onAction(action)
        onDismiss()
    }
    when (dialog) {
        DayDialog.NewWorkout -> TextInputDialog(
            title = stringResource(R.string.dialog_new_workout_title),
            label = stringResource(R.string.label_name),
            initial = stringResource(R.string.default_workout_name),
            onConfirm = { act(DayAction.CreateWorkout(it)) },
            onDismiss = onDismiss,
        )
        is DayDialog.RenameWorkout -> TextInputDialog(
            title = stringResource(R.string.dialog_rename_workout_title),
            label = stringResource(R.string.label_name),
            initial = dialog.workout.title,
            onConfirm = { act(DayAction.RenameWorkout(dialog.workout.id, it)) },
            onDismiss = onDismiss,
        )
        is DayDialog.SaveAsPlan -> TextInputDialog(
            title = stringResource(R.string.dialog_save_plan_title),
            label = stringResource(R.string.label_name),
            initial = dialog.workout.title,
            onConfirm = { act(DayAction.SaveAsPlan(dialog.workout.id, it)) },
            onDismiss = onDismiss,
        )
        is DayDialog.CopyWorkout -> DatePickerModal(
            initial = state.date.plusWeeks(1),
            onPick = { act(DayAction.CopyWorkout(dialog.workout.id, it)) },
            onDismiss = onDismiss,
        )
        is DayDialog.DeleteWorkout -> ConfirmDeleteDialog(
            title = stringResource(R.string.dialog_delete_workout_title),
            message = stringResource(R.string.dialog_delete_workout_message, dialog.workout.title),
            onConfirm = { act(DayAction.DeleteWorkout(dialog.workout.id)) },
            onDismiss = onDismiss,
        )
        is DayDialog.EditExercise -> EditExerciseDialog(
            initialName = dialog.exercise.name,
            initialNotes = dialog.exercise.notes,
            onSave = { name, notes -> act(DayAction.UpdateExercise(dialog.exercise.id, name, notes)) },
            onDismiss = onDismiss,
        )
        is DayDialog.DeleteExercise -> ConfirmDeleteDialog(
            title = stringResource(R.string.dialog_delete_exercise_title),
            message = stringResource(R.string.dialog_delete_exercise_message, dialog.exercise.name),
            onConfirm = { act(DayAction.DeleteExercise(dialog.exercise.id)) },
            onDismiss = onDismiss,
        )
        is DayDialog.EditSet -> SetDialog(
            set = dialog.set,
            number = dialog.number,
            onSave = { act(DayAction.UpdateSet(it)) },
            onDelete = { act(DayAction.DeleteSet(dialog.set.id)) },
            onDismiss = onDismiss,
        )
    }
}
