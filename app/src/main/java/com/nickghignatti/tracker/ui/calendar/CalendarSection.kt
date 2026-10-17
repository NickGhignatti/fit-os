package com.nickghignatti.tracker.ui.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.ui.components.TrackerCard
import com.nickghignatti.tracker.ui.format.displayName
import com.nickghignatti.tracker.ui.theme.Tracker
import java.time.LocalDate
import java.time.format.TextStyle
import java.time.temporal.WeekFields
import java.util.Locale

/** A month view with workout status dots; days open on tap. Hosts no scrolling of its own. */
@Composable
fun CalendarSection(
    state: CalendarUiState,
    onAction: (CalendarAction) -> Unit,
    onOpenDay: (LocalDate) -> Unit,
    modifier: Modifier = Modifier,
) {
    val locale = Locale.getDefault()
    val firstDayOfWeek = remember(locale) { WeekFields.of(locale).firstDayOfWeek }

    TrackerCard(modifier.fillMaxWidth()) {
        MonthHeader(state, onAction)
        Row(Modifier.padding(vertical = 8.dp)) {
            orderedWeek(firstDayOfWeek).forEach { day ->
                Text(
                    day.displayName(TextStyle.SHORT),
                    style = Tracker.type.labelSm,
                    color = Tracker.colors.inkSecondary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        monthGrid(state.month, firstDayOfWeek).chunked(DAYS_IN_WEEK).forEach { week ->
            Row {
                week.forEach { date ->
                    DayCell(
                        date = date,
                        status = date?.let(state::statusOf),
                        isToday = date == state.today,
                        onClick = { date?.let(onOpenDay) },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
        Legend(Modifier.padding(vertical = 16.dp))
    }
}

private enum class DayStatus { Planned, Completed }

private fun CalendarUiState.statusOf(date: LocalDate): DayStatus? {
    val summary = days[date]
    return when {
        summary?.isCompleted == true -> DayStatus.Completed
        summary != null || date in plannedDays -> DayStatus.Planned
        else -> null
    }
}

@Composable
private fun MonthHeader(state: CalendarUiState, onAction: (CalendarAction) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = { onAction(CalendarAction.PreviousMonth) }) {
            Icon(painterResource(R.drawable.ic_chevron_left), stringResource(R.string.calendar_previous_month))
        }
        Text(
            state.month.displayName(),
            style = Tracker.type.headlineMd,
            color = Tracker.colors.ink,
            textAlign = TextAlign.Center,
            modifier = Modifier.weight(1f),
        )
        IconButton(onClick = { onAction(CalendarAction.NextMonth) }) {
            Icon(painterResource(R.drawable.ic_chevron_right), stringResource(R.string.calendar_next_month))
        }
        TextButton(onClick = { onAction(CalendarAction.CurrentMonth) }) {
            Text(stringResource(R.string.calendar_today))
        }
    }
}

@Composable
private fun DayCell(
    date: LocalDate?,
    status: DayStatus?,
    isToday: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier.aspectRatio(1f).padding(2.dp)) {
        if (date == null) return@Box
        val colors = Tracker.colors
        val description = when (status) {
            null -> date.dayOfMonth.toString()
            DayStatus.Completed -> stringResource(R.string.calendar_day_completed, date.dayOfMonth)
            DayStatus.Planned -> stringResource(R.string.calendar_day_planned, date.dayOfMonth)
        }
        Column(
            modifier = Modifier
                .fillMaxSize()
                .clip(CircleShape)
                .then(if (isToday) Modifier.background(colors.ink) else Modifier)
                .clickable(onClick = onClick)
                .semantics { contentDescription = description },
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                date.dayOfMonth.toString(),
                style = Tracker.type.bodyMd,
                color = if (isToday) colors.inkInverse else colors.ink,
            )
            Spacer(Modifier.height(2.dp))
            StatusDot(
                when (status) {
                    null -> Color.Transparent
                    DayStatus.Completed -> if (isToday) colors.inkInverse else colors.accent
                    DayStatus.Planned -> colors.inkTertiary
                },
            )
        }
    }
}

@Composable
private fun StatusDot(color: Color) {
    Box(Modifier.size(6.dp).clip(CircleShape).background(color))
}

@Composable
private fun Legend(modifier: Modifier = Modifier) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
        LegendItem(Tracker.colors.inkTertiary, stringResource(R.string.calendar_legend_planned))
        LegendItem(Tracker.colors.accent, stringResource(R.string.calendar_legend_completed))
    }
}

@Composable
private fun LegendItem(color: Color, label: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        StatusDot(color)
        Text(label, style = Tracker.type.bodySm, color = Tracker.colors.inkSecondary)
    }
}
