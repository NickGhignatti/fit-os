package com.nickghignatti.tracker.ui.day

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import com.nickghignatti.tracker.domain.model.Exercise
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.ExerciseSet
import com.nickghignatti.tracker.domain.model.WorkoutTemplate
import com.nickghignatti.tracker.ui.components.CancelButton
import com.nickghignatti.tracker.ui.components.NumberField
import com.nickghignatti.tracker.ui.components.SentenceTextField
import com.nickghignatti.tracker.ui.format.formatWeight
import com.nickghignatti.tracker.ui.format.parseWeight

private const val MAX_SETS = 20

@Composable
internal fun NewWorkoutDialog(
    templates: List<WorkoutTemplate>,
    onCreate: (String) -> Unit,
    onUseTemplate: (Long) -> Unit,
    onDismiss: () -> Unit,
) {
    val defaultName = stringResource(R.string.default_workout_name)
    var title by rememberSaveable { mutableStateOf(defaultName) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.dialog_new_workout_title)) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                SentenceTextField(title, { title = it }, stringResource(R.string.label_name), Modifier.fillMaxWidth())
                if (templates.isNotEmpty()) {
                    Text(
                        stringResource(R.string.dialog_new_workout_from_template),
                        style = MaterialTheme.typography.labelLarge,
                        modifier = Modifier.padding(top = 16.dp, bottom = 4.dp),
                    )
                    templates.forEachIndexed { index, template ->
                        if (index > 0) HorizontalDivider()
                        ListItem(
                            headlineContent = { Text(template.name) },
                            supportingContent = { Text(template.exercises.joinToString { it.name }, maxLines = 2) },
                            modifier = Modifier.clickable { onUseTemplate(template.id) },
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onCreate(title) }, enabled = title.isNotBlank()) {
                Text(stringResource(R.string.dialog_new_workout_create_empty))
            }
        },
        dismissButton = { CancelButton(onDismiss) },
    )
}

/** Adds an exercise with N identical sets; single sets can be tweaked afterwards. */
@Composable
internal fun NewExerciseDialog(onSave: (ExercisePlan) -> Unit, onDismiss: () -> Unit) {
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
internal fun EditExerciseDialog(exercise: Exercise, onSave: (name: String, notes: String) -> Unit, onDismiss: () -> Unit) {
    var name by rememberSaveable { mutableStateOf(exercise.name) }
    var notes by rememberSaveable { mutableStateOf(exercise.notes) }
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
