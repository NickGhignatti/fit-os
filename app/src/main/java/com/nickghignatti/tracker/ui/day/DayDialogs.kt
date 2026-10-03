package com.nickghignatti.tracker.ui.day

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
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
import androidx.compose.ui.unit.dp
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.ExerciseSet
import com.nickghignatti.tracker.ui.components.CancelButton
import com.nickghignatti.tracker.ui.components.NumberField
import com.nickghignatti.tracker.ui.format.formatWeight
import com.nickghignatti.tracker.ui.format.parseWeight

@Composable
internal fun SetDialog(
    set: ExerciseSet,
    number: Int,
    onSave: (ExerciseSet) -> Unit,
    onDelete: () -> Unit,
    onDismiss: () -> Unit,
) {
    var plannedReps by rememberSaveable { mutableStateOf(set.plannedReps.toString()) }
    var plannedWeight by rememberSaveable { mutableStateOf(set.plannedWeight?.let(::formatWeight).orEmpty()) }
    var actualReps by rememberSaveable { mutableStateOf(set.actualReps?.toString().orEmpty()) }
    var actualWeight by rememberSaveable { mutableStateOf(set.actualWeight?.let(::formatWeight).orEmpty()) }
    var done by rememberSaveable { mutableStateOf(set.done) }

    val plannedRepsValue = plannedReps.toIntOrNull()?.takeIf { it > 0 }
    val actualRepsValue = actualReps.toIntOrNull()?.takeIf { it >= 0 }
    val plannedWeightValid = plannedWeight.isBlank() || parseWeight(plannedWeight) != null
    val actualRepsValid = actualReps.isBlank() || actualRepsValue != null
    val actualWeightValid = actualWeight.isBlank() || parseWeight(actualWeight) != null
    val valid = plannedRepsValue != null && plannedWeightValid && actualRepsValid && actualWeightValid

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.set_number, number)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.dialog_set_planned), style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NumberField(
                        plannedReps, { plannedReps = it }, stringResource(R.string.label_reps), Modifier.weight(1f),
                        isError = plannedRepsValue == null,
                    )
                    NumberField(
                        plannedWeight, { plannedWeight = it }, stringResource(R.string.label_kg), Modifier.weight(1f),
                        decimal = true, isError = !plannedWeightValid,
                    )
                }
                Text(stringResource(R.string.dialog_set_actual), style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NumberField(
                        actualReps, { actualReps = it }, stringResource(R.string.label_reps), Modifier.weight(1f),
                        isError = !actualRepsValid,
                    )
                    NumberField(
                        actualWeight, { actualWeight = it }, stringResource(R.string.label_kg), Modifier.weight(1f),
                        decimal = true, isError = !actualWeightValid,
                    )
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable { done = !done },
                ) {
                    Checkbox(checked = done, onCheckedChange = { done = it })
                    Text(stringResource(R.string.dialog_set_completed))
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(
                        set.copy(
                            plannedReps = plannedRepsValue!!,
                            plannedWeight = parseWeight(plannedWeight),
                            actualReps = actualRepsValue,
                            actualWeight = parseWeight(actualWeight),
                            done = done,
                        ),
                    )
                },
                enabled = valid,
            ) { Text(stringResource(R.string.action_save)) }
        },
        dismissButton = {
            Row {
                TextButton(onClick = onDelete) { Text(stringResource(R.string.dialog_set_delete)) }
                CancelButton(onDismiss)
            }
        },
    )
}
