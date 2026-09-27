@file:OptIn(ExperimentalMaterial3Api::class)

package com.nickghignatti.tracker.ui.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.DaySummary
import com.nickghignatti.tracker.ui.format.displayName
import java.time.LocalDate
import java.time.format.TextStyle
import java.time.temporal.WeekFields
import java.util.Locale

@Composable
fun CalendarScreen(
    onOpenDay: (LocalDate) -> Unit,
    viewModel: CalendarViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    CalendarScreen(state, viewModel::onAction, onOpenDay)
}

@Composable
internal fun CalendarScreen(
    state: CalendarUiState,
    onAction: (CalendarAction) -> Unit,
    onOpenDay: (LocalDate) -> Unit,
) {
    val locale = Locale.getDefault()
    val firstDayOfWeek = remember(locale) { WeekFields.of(locale).firstDayOfWeek }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.calendar_title)) },
                actions = {
                    TextButton(onClick = { onAction(CalendarAction.CurrentMonth) }) {
                        Text(stringResource(R.string.calendar_today))
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 12.dp),
        ) {
            MonthHeader(state, onAction)
            Row(Modifier.padding(vertical = 8.dp)) {
                orderedWeek(firstDayOfWeek).forEach { day ->
                    Text(
                        day.displayName(TextStyle.SHORT),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
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
                            summary = date?.let(state.days::get),
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
}

@Composable
private fun MonthHeader(state: CalendarUiState, onAction: (CalendarAction) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = { onAction(CalendarAction.PreviousMonth) }) {
            Icon(painterResource(R.drawable.ic_chevron_left), stringResource(R.string.calendar_previous_month))
        }
        Text(
            state.month.displayName(),
            style = MaterialTheme.typography.titleLarge,
            textAlign = TextAlign.Center,
            modifier = Modifier.weight(1f),
        )
        IconButton(onClick = { onAction(CalendarAction.NextMonth) }) {
            Icon(painterResource(R.drawable.ic_chevron_right), stringResource(R.string.calendar_next_month))
        }
    }
}

@Composable
private fun DayCell(
    date: LocalDate?,
    summary: DaySummary?,
    isToday: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier.aspectRatio(1f).padding(2.dp)) {
        if (date == null) return@Box
        val colors = MaterialTheme.colorScheme
        val description = when {
            summary == null -> date.dayOfMonth.toString()
            summary.isCompleted -> stringResource(R.string.calendar_day_completed, date.dayOfMonth)
            else -> stringResource(R.string.calendar_day_planned, date.dayOfMonth)
        }
        Column(
            modifier = Modifier
                .fillMaxSize()
                .clip(CircleShape)
                .then(if (isToday) Modifier.border(2.dp, colors.primary, CircleShape) else Modifier)
                .clickable(onClick = onClick)
                .semantics { contentDescription = description },
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                date.dayOfMonth.toString(),
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = if (isToday) FontWeight.Bold else null,
                color = if (isToday) colors.primary else colors.onSurface,
            )
            Spacer(Modifier.height(2.dp))
            StatusDot(
                when {
                    summary == null -> Color.Transparent
                    summary.isCompleted -> colors.primary
                    else -> colors.tertiary
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
        LegendItem(MaterialTheme.colorScheme.tertiary, stringResource(R.string.calendar_legend_planned))
        LegendItem(MaterialTheme.colorScheme.primary, stringResource(R.string.calendar_legend_completed))
    }
}

@Composable
private fun LegendItem(color: Color, label: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        StatusDot(color)
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
