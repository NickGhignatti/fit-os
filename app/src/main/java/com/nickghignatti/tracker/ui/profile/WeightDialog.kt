package com.nickghignatti.tracker.ui.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
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
import com.nickghignatti.tracker.ui.theme.ButtonKind
import com.nickghignatti.tracker.ui.components.TrackerButton
import com.nickghignatti.tracker.ui.components.CancelButton
import com.nickghignatti.tracker.ui.components.DatePickerModal
import com.nickghignatti.tracker.ui.components.NumberField
import com.nickghignatti.tracker.ui.format.formatWeight
import com.nickghignatti.tracker.ui.format.formatted
import com.nickghignatti.tracker.ui.format.parseWeight
import java.time.LocalDate
import java.time.format.FormatStyle

private val WEIGHT_RANGE_KG = 25.0..350.0

/** Logs a weigh-in (or edits one, with [onDelete]); another weigh-in on the same day replaces it. */
@Composable
fun WeightDialog(
    initialDate: LocalDate,
    initialKg: Double?,
    onSave: (date: LocalDate, kg: Double) -> Unit,
    onDismiss: () -> Unit,
    onDelete: (() -> Unit)? = null,
) {
    var kg by rememberSaveable { mutableStateOf(initialKg?.let(::formatWeight).orEmpty()) }
    var date by rememberSaveable { mutableStateOf(initialDate) }
    var pickingDate by rememberSaveable { mutableStateOf(false) }
    val kgValue = parseWeight(kg)?.takeIf { it in WEIGHT_RANGE_KG }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.weight_dialog_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField(kg, { kg = it }, stringResource(R.string.label_kg), Modifier.fillMaxWidth(), decimal = true, isError = kg.isNotBlank() && kgValue == null)
                TrackerButton(date.formatted(FormatStyle.MEDIUM), onClick = { pickingDate = true }, kind = ButtonKind.Secondary, compact = true)
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(date, kgValue!!) }, enabled = kgValue != null) { Text(stringResource(R.string.action_save)) }
        },
        dismissButton = {
            Row {
                if (onDelete != null) TextButton(onClick = onDelete) { Text(stringResource(R.string.action_delete)) }
                CancelButton(onDismiss)
            }
        },
    )

    if (pickingDate) {
        DatePickerModal(initial = date, onPick = { date = it; pickingDate = false }, onDismiss = { pickingDate = false })
    }
}
