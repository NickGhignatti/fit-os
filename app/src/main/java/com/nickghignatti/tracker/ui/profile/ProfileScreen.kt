package com.nickghignatti.tracker.ui.profile

import androidx.annotation.StringRes
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.DailyTargets
import com.nickghignatti.tracker.domain.model.WeightEntry
import com.nickghignatti.tracker.ui.calendar.CalendarSection
import com.nickghignatti.tracker.ui.calendar.CalendarViewModel
import com.nickghignatti.tracker.ui.components.Hairline
import com.nickghignatti.tracker.ui.components.SectionLabel
import com.nickghignatti.tracker.ui.components.TrackerButton
import com.nickghignatti.tracker.ui.components.TrackerCard
import com.nickghignatti.tracker.ui.components.TrackerTopBar
import com.nickghignatti.tracker.ui.food.kcalLabel
import com.nickghignatti.tracker.ui.food.macrosLabel
import com.nickghignatti.tracker.ui.format.formatWeight
import com.nickghignatti.tracker.ui.format.formatted
import com.nickghignatti.tracker.ui.theme.ButtonKind
import com.nickghignatti.tracker.ui.theme.Tracker
import java.time.LocalDate
import java.time.format.FormatStyle
import kotlin.math.abs
import kotlin.math.roundToInt

private const val RECENT_WEIGHINS = 5

/** The personal page: who you are, your daily goal, your weight, and the training calendar. */
@Composable
fun ProfileScreen(
    onOpenDay: (LocalDate) -> Unit,
    onEditProfile: () -> Unit,
    viewModel: ProfileViewModel = hiltViewModel(),
    calendarViewModel: CalendarViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val calendar by calendarViewModel.uiState.collectAsStateWithLifecycle()

    ProfileScreen(state, viewModel::onAction, onEditProfile) {
        CalendarSection(calendar, calendarViewModel::onAction, onOpenDay)
    }
}

/** Which weigh-in dialog is open: a new one, or an existing entry. */
private sealed interface WeightDialogState {
    data object New : WeightDialogState
    data class Edit(val entry: WeightEntry) : WeightDialogState
}

@Composable
internal fun ProfileScreen(
    state: ProfileUiState,
    onAction: (ProfileAction) -> Unit,
    onEditProfile: () -> Unit,
    calendar: @Composable () -> Unit = {},
) {
    var weightDialog by remember { mutableStateOf<WeightDialogState?>(null) }

    Scaffold(
        topBar = {
            TrackerTopBar(
                title = state.profile.name.ifBlank { stringResource(R.string.profile_title) },
                actions = {
                    IconButton(onClick = onEditProfile) {
                        Icon(painterResource(R.drawable.ic_edit), stringResource(R.string.profile_edit_title))
                    }
                },
            )
        },
    ) { padding ->
        if (state.isLoading) return@Scaffold
        Column(
            Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(Tracker.dimens.pageMargin),
            verticalArrangement = Arrangement.spacedBy(Tracker.dimens.md),
        ) {
            AboutCard(state, onEditProfile)
            GoalCard(state.targets, state.missingForGoal, onEditProfile, onLogWeight = { weightDialog = WeightDialogState.New })
            WeightCard(
                weights = state.weights,
                onLogWeight = { weightDialog = WeightDialogState.New },
                onEditEntry = { weightDialog = WeightDialogState.Edit(it) },
            )
            SectionLabel(stringResource(R.string.profile_section_calendar), Modifier.padding(top = Tracker.dimens.md))
            calendar()
        }
    }

    val dismiss = { weightDialog = null }
    when (val dialog = weightDialog) {
        null -> Unit
        WeightDialogState.New -> WeightDialog(
            initialDate = state.today,
            initialKg = state.latestWeight?.kg,
            onSave = { date, kg -> onAction(ProfileAction.LogWeight(date, kg)); dismiss() },
            onDismiss = dismiss,
        )
        is WeightDialogState.Edit -> WeightDialog(
            initialDate = dialog.entry.date,
            initialKg = dialog.entry.kg,
            onSave = { date, kg ->
                if (date != dialog.entry.date) onAction(ProfileAction.DeleteWeight(dialog.entry.id))
                onAction(ProfileAction.LogWeight(date, kg))
                dismiss()
            },
            onDelete = { onAction(ProfileAction.DeleteWeight(dialog.entry.id)); dismiss() },
            onDismiss = dismiss,
        )
    }
}

@Composable
private fun AboutCard(state: ProfileUiState, onEdit: () -> Unit) {
    val profile = state.profile
    val facts = listOfNotNull(
        state.age?.let { stringResource(R.string.profile_age_value, it) },
        profile.heightCm?.let { stringResource(R.string.profile_height_value, formatWeight(it)) },
        profile.sex?.let { stringResource(it.label()) },
    )
    TrackerCard(Modifier.fillMaxWidth()) {
        CardTitle(stringResource(R.string.profile_about))
        if (facts.isEmpty()) {
            Text(stringResource(R.string.profile_about_empty), style = Tracker.type.bodyMd, color = Tracker.colors.ink)
            TrackerButton(
                text = stringResource(R.string.profile_set_up),
                onClick = onEdit,
                kind = ButtonKind.Secondary,
                compact = true,
                modifier = Modifier.padding(top = Tracker.dimens.md),
            )
        } else {
            Text(facts.joinToString(" · "), style = Tracker.type.bodyLg, color = Tracker.colors.ink)
            Text(
                stringResource(profile.activity.label()) + " · " + stringResource(profile.pace.label()),
                style = Tracker.type.bodyMd,
                color = Tracker.colors.inkSecondary,
            )
        }
    }
}

@Composable
private fun GoalCard(targets: DailyTargets?, missing: List<MissingInfo>, onEdit: () -> Unit, onLogWeight: () -> Unit) {
    TrackerCard(Modifier.fillMaxWidth()) {
        CardTitle(stringResource(R.string.profile_daily_goal))
        if (targets == null) {
            val names = missing.map { stringResource(it.label()) }
            Text(
                stringResource(R.string.profile_goal_missing, names.joinToString(", ")),
                style = Tracker.type.bodyMd,
                color = Tracker.colors.ink,
            )
            Row(Modifier.padding(top = Tracker.dimens.md), horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.sm)) {
                if (missing.any { it != MissingInfo.WEIGHT }) {
                    TrackerButton(stringResource(R.string.profile_set_up), onEdit, kind = ButtonKind.Secondary, compact = true)
                }
                if (MissingInfo.WEIGHT in missing) {
                    TrackerButton(stringResource(R.string.weight_log), onLogWeight, kind = ButtonKind.Secondary, compact = true)
                }
            }
        } else {
            Text(kcalLabel(targets.nutrients.kcal), style = Tracker.type.metricXl, color = Tracker.colors.ink)
            Text(macrosLabel(targets.nutrients), style = Tracker.type.bodyMd, color = Tracker.colors.ink)
            Text(
                stringResource(if (targets.isCustom) R.string.profile_goal_custom else R.string.profile_goal_computed),
                style = Tracker.type.bodySm,
                color = Tracker.colors.inkSecondary,
                modifier = Modifier.padding(top = Tracker.dimens.xs),
            )
        }
    }
}

@Composable
private fun WeightCard(weights: List<WeightEntry>, onLogWeight: () -> Unit, onEditEntry: (WeightEntry) -> Unit) {
    TrackerCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            CardTitle(stringResource(R.string.weight_title), Modifier.weight(1f))
            TrackerButton(stringResource(R.string.weight_log), onLogWeight, kind = ButtonKind.Secondary, compact = true)
        }
        val latest = weights.lastOrNull()
        if (latest == null) {
            Text(
                stringResource(R.string.weight_empty),
                style = Tracker.type.bodyMd,
                color = Tracker.colors.inkSecondary,
                modifier = Modifier.padding(top = Tracker.dimens.sm),
            )
            return@TrackerCard
        }
        Row(Modifier.padding(vertical = Tracker.dimens.sm), verticalAlignment = Alignment.Bottom) {
            Text(stringResource(R.string.kg_value, formatWeight(latest.kg)), style = Tracker.type.metricXl, color = Tracker.colors.ink)
            Spacer(Modifier.width(Tracker.dimens.sm))
            if (weights.size > 1) {
                val change = latest.kg - weights.first().kg
                Text(
                    stringResource(
                        R.string.weight_change_since,
                        signedKg(change),
                        weights.first().date.formatted(FormatStyle.MEDIUM),
                    ),
                    style = Tracker.type.bodySm,
                    color = Tracker.colors.inkSecondary,
                    modifier = Modifier.padding(bottom = Tracker.dimens.xs),
                )
            }
        }
        WeightChart(weights)
        weights.takeLast(RECENT_WEIGHINS).asReversed().forEach { entry ->
            Hairline()
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = Tracker.dimens.rowMinHeight + Tracker.dimens.sm)
                    .clickable { onEditEntry(entry) },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(entry.date.formatted(FormatStyle.MEDIUM), style = Tracker.type.bodyMd, color = Tracker.colors.ink, modifier = Modifier.weight(1f))
                Text(stringResource(R.string.kg_value, formatWeight(entry.kg)), style = Tracker.type.tabularCaption, color = Tracker.colors.ink)
            }
        }
    }
}

@Composable
private fun CardTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text.uppercase(),
        style = Tracker.type.labelSm,
        color = Tracker.colors.inkSecondary,
        modifier = modifier.padding(bottom = Tracker.dimens.sm),
    )
}

/** "+1.2", "−0.8" or "±0", to one decimal and with a true minus sign. */
private fun signedKg(change: Double): String {
    val tenths = (change * 10).roundToInt()
    val kg = formatWeight(abs(tenths) / 10.0)
    return when {
        tenths > 0 -> "+$kg"
        tenths < 0 -> "−$kg"
        else -> "±0"
    }
}

@StringRes
private fun MissingInfo.label(): Int = when (this) {
    MissingInfo.SEX -> R.string.profile_sex
    MissingInfo.BIRTH_DATE -> R.string.profile_birth_date
    MissingInfo.HEIGHT -> R.string.profile_height
    MissingInfo.WEIGHT -> R.string.weight_title
}
