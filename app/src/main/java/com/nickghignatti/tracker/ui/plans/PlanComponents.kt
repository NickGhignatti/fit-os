package com.nickghignatti.tracker.ui.plans

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryScrollableTabRow
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.ui.calendar.orderedWeek
import com.nickghignatti.tracker.ui.components.CancelButton
import com.nickghignatti.tracker.ui.components.SentenceTextField
import com.nickghignatti.tracker.ui.format.displayName
import java.time.DayOfWeek
import java.time.format.TextStyle
import java.time.temporal.WeekFields
import java.util.Locale

@Composable
fun recurrenceLabel(recurrence: Recurrence): String = stringResource(
    when (recurrence) {
        Recurrence.DAILY -> R.string.plan_daily
        Recurrence.WEEKLY -> R.string.plan_weekly
    },
)

/** "Mon · Wed · Fri" for the weekdays of a weekly plan that have something planned. */
fun weekdaysSummary(days: List<PlanDay>): String =
    days.filterIsInstance<PlanDay.Weekday>().joinToString(" · ") { it.day.displayName(TextStyle.SHORT) }

/** The days of the week in the user's locale order. */
@Composable
fun rememberLocalWeek(): List<DayOfWeek> {
    val locale = Locale.getDefault()
    return remember(locale) { orderedWeek(WeekFields.of(locale).firstDayOfWeek) }
}

/** Weekday tabs for editing a weekly plan one day at a time; today is marked. */
@Composable
fun WeekdayTabs(
    selected: DayOfWeek,
    today: DayOfWeek,
    onSelect: (DayOfWeek) -> Unit,
    modifier: Modifier = Modifier,
) {
    val week = rememberLocalWeek()
    PrimaryScrollableTabRow(selectedTabIndex = week.indexOf(selected), edgePadding = 8.dp, modifier = modifier) {
        week.forEach { day ->
            val label = day.displayName(TextStyle.SHORT)
            Tab(
                selected = day == selected,
                onClick = { onSelect(day) },
                text = { Text(if (day == today) stringResource(R.string.today_tab_marker, label) else label) },
            )
        }
    }
}

@Composable
internal fun PlanLabel(text: String, highlighted: Boolean = false) {
    val colors = MaterialTheme.colorScheme
    Surface(
        shape = MaterialTheme.shapes.small,
        color = if (highlighted) colors.primaryContainer else colors.surfaceVariant,
        contentColor = if (highlighted) colors.onPrimaryContainer else colors.onSurfaceVariant,
    ) {
        Text(text, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp))
    }
}

@Composable
internal fun NewPlanDialog(
    title: String,
    defaultName: String,
    dailyDescription: String,
    weeklyDescription: String,
    onCreate: (name: String, recurrence: Recurrence) -> Unit,
    onDismiss: () -> Unit,
) {
    var name by rememberSaveable { mutableStateOf(defaultName) }
    var recurrence by rememberSaveable { mutableStateOf(Recurrence.WEEKLY) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SentenceTextField(name, { name = it }, stringResource(R.string.label_name), Modifier.fillMaxWidth())
                Text(
                    stringResource(R.string.plan_repeats),
                    style = MaterialTheme.typography.labelLarge,
                    modifier = Modifier.padding(top = 8.dp),
                )
                Column(Modifier.selectableGroup()) {
                    RecurrenceOption(Recurrence.DAILY, dailyDescription, recurrence == Recurrence.DAILY) { recurrence = it }
                    RecurrenceOption(Recurrence.WEEKLY, weeklyDescription, recurrence == Recurrence.WEEKLY) { recurrence = it }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onCreate(name, recurrence) }, enabled = name.isNotBlank()) {
                Text(stringResource(R.string.action_create))
            }
        },
        dismissButton = { CancelButton(onDismiss) },
    )
}

@Composable
private fun RecurrenceOption(
    recurrence: Recurrence,
    description: String,
    selected: Boolean,
    onSelect: (Recurrence) -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .selectable(selected = selected, role = Role.RadioButton, onClick = { onSelect(recurrence) }),
    ) {
        RadioButton(selected = selected, onClick = null, modifier = Modifier.padding(end = 12.dp))
        Column {
            Text(recurrenceLabel(recurrence), style = MaterialTheme.typography.bodyLarge)
            Text(description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
