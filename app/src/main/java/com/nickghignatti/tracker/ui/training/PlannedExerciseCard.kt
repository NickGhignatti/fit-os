package com.nickghignatti.tracker.ui.training

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.PlannedExercise
import com.nickghignatti.tracker.domain.model.PlannedSet
import com.nickghignatti.tracker.domain.model.SetPlan
import com.nickghignatti.tracker.ui.components.CancelButton
import com.nickghignatti.tracker.ui.components.MenuItem
import com.nickghignatti.tracker.ui.components.NumberField
import com.nickghignatti.tracker.ui.components.OverflowMenu
import com.nickghignatti.tracker.ui.format.formatWeight
import com.nickghignatti.tracker.ui.format.parseWeight
import com.nickghignatti.tracker.ui.format.setLabel
import com.nickghignatti.tracker.ui.theme.TrackerTheme

@Composable
internal fun PlannedExerciseCard(
    exercise: PlannedExercise,
    onOpenDialog: (TrainingPlanDialog) -> Unit,
    onAction: (TrainingPlanAction) -> Unit,
    modifier: Modifier = Modifier,
) {
    ElevatedCard(modifier.fillMaxWidth()) {
        Column(Modifier.padding(vertical = 8.dp)) {
            Row(Modifier.padding(start = 16.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(exercise.name, style = MaterialTheme.typography.titleMedium)
                    if (exercise.notes.isNotBlank()) {
                        Text(
                            exercise.notes,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                OverflowMenu(
                    listOf(
                        MenuItem(stringResource(R.string.exercise_add_set)) { onAction(TrainingPlanAction.AddSet(exercise)) },
                        MenuItem(stringResource(R.string.exercise_edit)) { onOpenDialog(TrainingPlanDialog.EditExercise(exercise)) },
                        MenuItem(stringResource(R.string.action_delete)) { onOpenDialog(TrainingPlanDialog.DeleteExercise(exercise)) },
                    ),
                )
            }
            if (exercise.sets.isEmpty()) {
                Text(
                    stringResource(R.string.exercise_no_sets),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }
            exercise.sets.forEachIndexed { index, set ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clickable { onOpenDialog(TrainingPlanDialog.EditSet(set, index + 1)) }
                        .padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        stringResource(R.string.set_number, index + 1),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.width(56.dp),
                    )
                    Text(setLabel(set.reps, set.weight), style = MaterialTheme.typography.bodyLarge)
                }
            }
        }
    }
}

@Composable
internal fun PlannedSetDialog(
    set: PlannedSet,
    number: Int,
    onSave: (SetPlan) -> Unit,
    onDelete: () -> Unit,
    onDismiss: () -> Unit,
) {
    var reps by rememberSaveable { mutableStateOf(set.reps.toString()) }
    var weight by rememberSaveable { mutableStateOf(set.weight?.let(::formatWeight).orEmpty()) }

    val repsValue = reps.toIntOrNull()?.takeIf { it > 0 }
    val weightValid = weight.isBlank() || parseWeight(weight) != null

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.set_number, number)) },
        text = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField(reps, { reps = it }, stringResource(R.string.label_reps), Modifier.weight(1f), isError = repsValue == null)
                NumberField(
                    weight, { weight = it }, stringResource(R.string.label_kg), Modifier.weight(1f),
                    decimal = true, isError = !weightValid,
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(SetPlan(repsValue!!, parseWeight(weight))) }, enabled = repsValue != null && weightValid) {
                Text(stringResource(R.string.action_save))
            }
        },
        dismissButton = {
            Row {
                TextButton(onClick = onDelete) { Text(stringResource(R.string.dialog_set_delete)) }
                CancelButton(onDismiss)
            }
        },
    )
}

@Preview(showBackground = true)
@Composable
private fun PlannedExerciseCardPreview() {
    TrackerTheme {
        PlannedExerciseCard(
            exercise = PlannedExercise(1, "Bench press", "Pause on chest", listOf(PlannedSet(2, 8, 60.0), PlannedSet(3, 8, 62.5))),
            onOpenDialog = {},
            onAction = {},
        )
    }
}
