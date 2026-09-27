@file:OptIn(ExperimentalMaterial3Api::class)

package com.nickghignatti.tracker.ui.templates

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.WorkoutTemplate
import com.nickghignatti.tracker.ui.components.ConfirmDeleteDialog
import com.nickghignatti.tracker.ui.components.DatePickerModal
import com.nickghignatti.tracker.ui.components.EmptyState
import com.nickghignatti.tracker.ui.components.MenuItem
import com.nickghignatti.tracker.ui.components.OverflowMenu
import com.nickghignatti.tracker.ui.components.TextInputDialog
import com.nickghignatti.tracker.ui.format.setsSummary
import java.time.LocalDate

private sealed interface TemplateDialog {
    val template: WorkoutTemplate

    data class UseOnDay(override val template: WorkoutTemplate) : TemplateDialog
    data class Rename(override val template: WorkoutTemplate) : TemplateDialog
    data class Delete(override val template: WorkoutTemplate) : TemplateDialog
}

@Composable
fun TemplatesScreen(
    onOpenDay: (LocalDate) -> Unit,
    viewModel: TemplatesViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(viewModel) {
        viewModel.events.collect { event ->
            when (event) {
                is TemplatesEvent.TemplateApplied -> onOpenDay(event.date)
            }
        }
    }

    TemplatesScreen(state, viewModel::onAction)
}

@Composable
internal fun TemplatesScreen(state: TemplatesUiState, onAction: (TemplatesAction) -> Unit) {
    var dialog by remember { mutableStateOf<TemplateDialog?>(null) }

    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.templates_title)) }) }) { padding ->
        when {
            state.isLoading -> Unit
            state.templates.isEmpty() -> EmptyState(stringResource(R.string.templates_empty), Modifier.padding(padding))
            else -> LazyColumn(
                modifier = Modifier.padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(state.templates, key = { it.id }) { template ->
                    TemplateCard(template, onOpenDialog = { dialog = it })
                }
            }
        }
    }

    val dismiss = { dialog = null }
    when (val current = dialog) {
        null -> Unit
        is TemplateDialog.UseOnDay -> DatePickerModal(
            initial = state.today,
            onPick = { onAction(TemplatesAction.ApplyToDay(current.template.id, it)); dismiss() },
            onDismiss = dismiss,
        )
        is TemplateDialog.Rename -> TextInputDialog(
            title = stringResource(R.string.dialog_rename_template_title),
            label = stringResource(R.string.label_name),
            initial = current.template.name,
            onConfirm = { onAction(TemplatesAction.Rename(current.template.id, it)); dismiss() },
            onDismiss = dismiss,
        )
        is TemplateDialog.Delete -> ConfirmDeleteDialog(
            title = stringResource(R.string.dialog_delete_template_title),
            message = stringResource(R.string.dialog_delete_template_message, current.template.name),
            onConfirm = { onAction(TemplatesAction.Delete(current.template.id)); dismiss() },
            onDismiss = dismiss,
        )
    }
}

@Composable
private fun TemplateCard(template: WorkoutTemplate, onOpenDialog: (TemplateDialog) -> Unit) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(start = 16.dp, top = 8.dp, end = 4.dp, bottom = 16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(template.name, style = MaterialTheme.typography.titleLarge)
                    Text(
                        stringResource(
                            R.string.templates_summary,
                            pluralStringResource(R.plurals.exercise_count, template.exercises.size, template.exercises.size),
                            pluralStringResource(R.plurals.set_count, template.totalSets, template.totalSets),
                        ),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                OverflowMenu(
                    listOf(
                        MenuItem(stringResource(R.string.action_rename)) { onOpenDialog(TemplateDialog.Rename(template)) },
                        MenuItem(stringResource(R.string.action_delete)) { onOpenDialog(TemplateDialog.Delete(template)) },
                    ),
                )
            }
            Column(Modifier.padding(top = 8.dp, end = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                template.exercises.forEach { exercise ->
                    Row {
                        Text(exercise.name, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                        Text(
                            setsSummary(exercise.sets),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            FilledTonalButton(
                onClick = { onOpenDialog(TemplateDialog.UseOnDay(template)) },
                modifier = Modifier.padding(top = 12.dp),
            ) { Text(stringResource(R.string.templates_use_on_day)) }
        }
    }
}
