@file:OptIn(ExperimentalMaterial3Api::class)

package com.nickghignatti.tracker.ui.training

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.PlannedExercise
import com.nickghignatti.tracker.domain.model.PlannedSet
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.ui.components.ConfirmDeleteDialog
import com.nickghignatti.tracker.ui.components.EditExerciseDialog
import com.nickghignatti.tracker.ui.components.EmptyState
import com.nickghignatti.tracker.ui.format.displayName
import com.nickghignatti.tracker.ui.plans.WeekdayTabs
import com.nickghignatti.tracker.ui.plans.recurrenceLabel

/** Which dialog is open; transient UI state, so it lives in the screen, not the ViewModel. */
internal sealed interface TrainingPlanDialog {
    data class EditExercise(val exercise: PlannedExercise) : TrainingPlanDialog
    data class DeleteExercise(val exercise: PlannedExercise) : TrainingPlanDialog
    data class EditSet(val set: PlannedSet, val number: Int) : TrainingPlanDialog
}

@Composable
fun TrainingPlanScreen(
    onBack: () -> Unit,
    onAddExercise: (planId: Long, day: PlanDay) -> Unit,
    onOpenExercise: (catalogId: String) -> Unit,
    viewModel: TrainingPlanViewModel,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    TrainingPlanScreen(state, viewModel::onAction, onBack, onAddExercise, onOpenExercise)
}

@Composable
internal fun TrainingPlanScreen(
    state: TrainingPlanUiState,
    onAction: (TrainingPlanAction) -> Unit,
    onBack: () -> Unit,
    onAddExercise: (planId: Long, day: PlanDay) -> Unit = { _, _ -> },
    onOpenExercise: (catalogId: String) -> Unit = {},
) {
    val plan = state.plan
    if (!state.isLoading && plan == null) {
        // Deleted elsewhere: nothing left to edit.
        LaunchedEffect(Unit) { onBack() }
        return
    }
    var dialog by remember { mutableStateOf<TrainingPlanDialog?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(plan?.name.orEmpty())
                        if (plan != null) {
                            Text(
                                recurrenceLabel(plan.recurrence),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(painterResource(R.drawable.ic_arrow_back), stringResource(R.string.action_back))
                    }
                },
            )
        },
        floatingActionButton = {
            val day = state.planDay
            if (plan != null && day != null) {
                ExtendedFloatingActionButton(
                    onClick = { onAddExercise(plan.id, day) },
                    icon = { Icon(painterResource(R.drawable.ic_add), contentDescription = null) },
                    text = { Text(stringResource(R.string.workout_add_exercise)) },
                )
            }
        },
    ) { padding ->
        if (plan == null) return@Scaffold
        Column(Modifier.padding(padding)) {
            if (plan.recurrence == Recurrence.WEEKLY) {
                WeekdayTabs(
                    selected = state.selectedDay,
                    today = state.today,
                    onSelect = { onAction(TrainingPlanAction.SelectDay(it)) },
                )
            }
            if (state.exercises.isEmpty()) {
                EmptyState(
                    when (plan.recurrence) {
                        Recurrence.DAILY -> stringResource(R.string.training_plan_empty_daily)
                        Recurrence.WEEKLY -> stringResource(R.string.training_plan_empty_weekly, state.selectedDay.displayName())
                    },
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, top = 16.dp, end = 16.dp, bottom = 96.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(state.exercises, key = { it.id }) { exercise ->
                        PlannedExerciseCard(exercise, onOpenDialog = { dialog = it }, onAction = onAction, onOpenExercise = onOpenExercise)
                    }
                }
            }
        }
    }

    val dismiss = { dialog = null }
    val act = { action: TrainingPlanAction ->
        onAction(action)
        dismiss()
    }
    when (val current = dialog) {
        null -> Unit
        is TrainingPlanDialog.EditExercise -> EditExerciseDialog(
            initialName = current.exercise.name,
            initialNotes = current.exercise.notes,
            onSave = { name, notes -> act(TrainingPlanAction.UpdateExercise(current.exercise.id, name, notes)) },
            onDismiss = dismiss,
        )
        is TrainingPlanDialog.DeleteExercise -> ConfirmDeleteDialog(
            title = stringResource(R.string.dialog_delete_exercise_title),
            message = stringResource(R.string.dialog_delete_exercise_message, current.exercise.name),
            onConfirm = { act(TrainingPlanAction.DeleteExercise(current.exercise.id)) },
            onDismiss = dismiss,
        )
        is TrainingPlanDialog.EditSet -> PlannedSetDialog(
            set = current.set,
            number = current.number,
            onSave = { act(TrainingPlanAction.UpdateSet(current.set.id, it)) },
            onDelete = { act(TrainingPlanAction.DeleteSet(current.set.id)) },
            onDismiss = dismiss,
        )
    }
}
