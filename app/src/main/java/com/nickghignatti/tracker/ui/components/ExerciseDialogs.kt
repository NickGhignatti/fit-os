package com.nickghignatti.tracker.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.ui.format.parseWeight

// Exercise dialogs shared by logged workouts and training plans.

private const val MAX_SETS = 20

/** Adds an exercise with N identical sets; single sets can be tweaked afterwards. */
@Composable
fun NewExerciseDialog(onSave: (ExercisePlan) -> Unit, onDismiss: () -> Unit) {
    var name by rememberSaveable { mutableStateOf("") }
    var notes by rememberSaveable { mutableStateOf("") }
    var sets by rememberSaveable { mutableStateOf("3") }
    var reps by rememberSaveable { mutableStateOf("10") }
    var weight by rememberSaveable { mutableStateOf("") }

    val setCount = sets.toIntOrNull()?.takeIf { it in 1..MAX_SETS }
    val repCount = reps.toIntOrNull()?.takeIf { it > 0 }
    val weightValue = parseWeight(weight)
    val weightValid = weight.isBlank() || weightValue != null
    val valid = name.isNotBlank() && setCount != null && repCount != null && weightValid

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.dialog_add_exercise_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SentenceTextField(name, { name = it }, stringResource(R.string.label_exercise), Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NumberField(sets, { sets = it }, stringResource(R.string.label_sets), Modifier.weight(1f), isError = setCount == null)
                    NumberField(reps, { reps = it }, stringResource(R.string.label_reps), Modifier.weight(1f), isError = repCount == null)
                    NumberField(
                        weight, { weight = it }, stringResource(R.string.label_kg), Modifier.weight(1f),
                        decimal = true, isError = !weightValid,
                    )
                }
                Text(
                    stringResource(R.string.dialog_add_exercise_hint),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                NotesField(notes) { notes = it }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(ExercisePlan.uniform(name, notes, setCount!!, repCount!!, weightValue)) },
                enabled = valid,
            ) { Text(stringResource(R.string.action_save)) }
        },
        dismissButton = { CancelButton(onDismiss) },
    )
}

@Composable
fun EditExerciseDialog(
    initialName: String,
    initialNotes: String,
    onSave: (name: String, notes: String) -> Unit,
    onDismiss: () -> Unit,
) {
    var name by rememberSaveable { mutableStateOf(initialName) }
    var notes by rememberSaveable { mutableStateOf(initialNotes) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.dialog_edit_exercise_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SentenceTextField(name, { name = it }, stringResource(R.string.label_exercise), Modifier.fillMaxWidth())
                NotesField(notes) { notes = it }
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(name, notes) }, enabled = name.isNotBlank()) {
                Text(stringResource(R.string.action_save))
            }
        },
        dismissButton = { CancelButton(onDismiss) },
    )
}

@Composable
private fun NotesField(value: String, onValueChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(stringResource(R.string.label_notes_optional)) },
        modifier = Modifier.fillMaxWidth(),
    )
}
