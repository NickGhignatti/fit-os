@file:OptIn(ExperimentalMaterial3Api::class)

package com.nickghignatti.tracker.ui.exercises

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.ui.components.FilterPill
import com.nickghignatti.tracker.ui.components.TrackerTopBar
import com.nickghignatti.tracker.ui.components.TrackerBackButton
import com.nickghignatti.tracker.domain.model.Equipment
import com.nickghignatti.tracker.domain.model.ExerciseInfo
import com.nickghignatti.tracker.domain.model.Muscle
import com.nickghignatti.tracker.ui.components.NewExerciseDialog

@Composable
fun ExercisePickerScreen(
    onDone: () -> Unit,
    onOpenExercise: (String) -> Unit,
    viewModel: ExercisePickerViewModel,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(viewModel) {
        viewModel.events.collect { event ->
            when (event) {
                ExercisePickerEvent.Added -> onDone()
            }
        }
    }

    ExercisePickerScreen(state, viewModel::onAction, onBack = onDone, onOpenExercise = onOpenExercise)
}

@Composable
internal fun ExercisePickerScreen(
    state: ExercisePickerUiState,
    onAction: (ExercisePickerAction) -> Unit,
    onBack: () -> Unit,
    onOpenExercise: (String) -> Unit,
) {
    var creatingCustom by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TrackerTopBar(title = stringResource(R.string.dialog_add_exercise_title), navigation = { TrackerBackButton(onBack) },)
        },
    ) { padding ->
        LazyColumn(Modifier.padding(padding), contentPadding = PaddingValues(bottom = 24.dp)) {
            item {
                OutlinedTextField(
                    value = state.query,
                    onValueChange = { onAction(ExercisePickerAction.QueryChanged(it)) },
                    placeholder = { Text(stringResource(R.string.exercises_search_hint)) },
                    leadingIcon = { Icon(painterResource(R.drawable.ic_search), contentDescription = null) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                )
            }
            item {
                ChipRow(Muscle.entries, selected = state.filter.muscle, label = { stringResource(it.label()) }) {
                    onAction(ExercisePickerAction.ToggleMuscle(it))
                }
            }
            item {
                ChipRow(Equipment.entries, selected = state.filter.equipment, label = { stringResource(it.label()) }) {
                    onAction(ExercisePickerAction.ToggleEquipment(it))
                }
            }
            item {
                TextButton(onClick = { creatingCustom = true }, modifier = Modifier.padding(horizontal = 8.dp)) {
                    Text(stringResource(R.string.exercises_custom))
                }
                HorizontalDivider(Modifier.padding(horizontal = 16.dp))
            }
            if (!state.isLoading && state.results.isEmpty()) {
                item {
                    Text(
                        stringResource(R.string.exercises_none),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(16.dp),
                    )
                }
            }
            items(state.results, key = { it.id }) { exercise ->
                ExerciseRow(
                    exercise = exercise,
                    onClick = { onAction(ExercisePickerAction.Pick(exercise)) },
                    onInfo = { onOpenExercise(exercise.id) },
                )
            }
            item { CatalogAttribution() }
        }
    }

    state.picked?.let { exercise ->
        NewExerciseDialog(
            initialName = exercise.name,
            catalogId = exercise.id,
            onSave = { onAction(ExercisePickerAction.Add(it)) },
            onDismiss = { onAction(ExercisePickerAction.DismissPick) },
        )
    }
    if (creatingCustom) {
        NewExerciseDialog(
            initialName = state.query.trim(),
            onSave = { onAction(ExercisePickerAction.Add(it)); creatingCustom = false },
            onDismiss = { creatingCustom = false },
        )
    }
}

@Composable
internal fun <T> ChipRow(values: List<T>, selected: T?, label: @Composable (T) -> String, onToggle: (T) -> Unit) {
    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        values.forEach { value ->
            FilterPill(text = label(value), selected = value == selected, onClick = { onToggle(value) })
        }
    }
}

@Composable
internal fun ExerciseRow(exercise: ExerciseInfo, onClick: () -> Unit, onInfo: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .clickable(onClick = onClick)
            .padding(start = 16.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f).padding(vertical = 8.dp)) {
            Text(exercise.name, style = MaterialTheme.typography.bodyLarge)
            Text(
                exerciseSummary(exercise),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        HowToButton(exercise.name, onInfo)
    }
}

@Composable
internal fun CatalogAttribution(modifier: Modifier = Modifier) {
    Text(
        stringResource(R.string.exercises_attribution),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier.padding(16.dp),
    )
}
