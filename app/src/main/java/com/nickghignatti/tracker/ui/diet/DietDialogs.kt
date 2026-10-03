package com.nickghignatti.tracker.ui.diet

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.Food
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.ui.components.CancelButton
import com.nickghignatti.tracker.ui.components.SentenceTextField
import com.nickghignatti.tracker.ui.format.displayName
import java.time.DayOfWeek

private val MEAL_SUGGESTIONS = listOf(R.string.meal_breakfast, R.string.meal_snack, R.string.meal_lunch, R.string.meal_dinner)

@Composable
internal fun MealDialog(existing: Meal?, onSave: (name: String, time: String) -> Unit, onDismiss: () -> Unit) {
    var name by rememberSaveable { mutableStateOf(existing?.name.orEmpty()) }
    var time by rememberSaveable { mutableStateOf(existing?.time.orEmpty()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(if (existing == null) R.string.dialog_add_meal_title else R.string.dialog_edit_meal_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (existing == null) {
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        MEAL_SUGGESTIONS.forEach { suggestionRes ->
                            val suggestion = stringResource(suggestionRes)
                            AssistChip(onClick = { name = suggestion }, label = { Text(suggestion) })
                        }
                    }
                }
                SentenceTextField(name, { name = it }, stringResource(R.string.label_meal), Modifier.fillMaxWidth())
                OutlinedTextField(
                    value = time,
                    onValueChange = { time = it },
                    label = { Text(stringResource(R.string.label_time_optional)) },
                    placeholder = { Text(stringResource(R.string.hint_time)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(name, time) }, enabled = name.isNotBlank()) {
                Text(stringResource(R.string.action_save))
            }
        },
        dismissButton = { CancelButton(onDismiss) },
    )
}

@Composable
internal fun FoodDialog(
    title: String,
    existing: Food?,
    onSave: (name: String, quantity: String) -> Unit,
    onDelete: (() -> Unit)?,
    onDismiss: () -> Unit,
    initialName: String = "",
) {
    var name by rememberSaveable { mutableStateOf(existing?.name ?: initialName) }
    var quantity by rememberSaveable { mutableStateOf(existing?.quantity.orEmpty()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SentenceTextField(name, { name = it }, stringResource(R.string.label_food), Modifier.fillMaxWidth())
                OutlinedTextField(
                    value = quantity,
                    onValueChange = { quantity = it },
                    label = { Text(stringResource(R.string.label_quantity_optional)) },
                    placeholder = { Text(stringResource(R.string.hint_quantity)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(name, quantity) }, enabled = name.isNotBlank()) {
                Text(stringResource(R.string.action_save))
            }
        },
        dismissButton = {
            Row {
                if (onDelete != null) TextButton(onClick = onDelete) { Text(stringResource(R.string.action_delete)) }
                CancelButton(onDismiss)
            }
        },
    )
}

@Composable
internal fun CopyDayDialog(
    source: DayOfWeek,
    week: List<DayOfWeek>,
    onCopy: (Set<DayOfWeek>) -> Unit,
    onDismiss: () -> Unit,
) {
    var selected by remember { mutableStateOf(emptySet<DayOfWeek>()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.dialog_copy_day_title, source.displayName())) },
        text = {
            Column {
                Text(
                    stringResource(R.string.dialog_copy_day_message),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
                week.filter { it != source }.forEach { day ->
                    val toggle = { selected = if (day in selected) selected - day else selected + day }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable(onClick = toggle),
                    ) {
                        Checkbox(checked = day in selected, onCheckedChange = { toggle() })
                        Text(day.displayName())
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onCopy(selected) }, enabled = selected.isNotEmpty()) {
                Text(stringResource(R.string.action_copy))
            }
        },
        dismissButton = { CancelButton(onDismiss) },
    )
}
