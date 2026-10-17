package com.nickghignatti.tracker.ui.training

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.Equipment
import com.nickghignatti.tracker.domain.model.Muscle
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.model.TrainingPlan
import com.nickghignatti.tracker.domain.repository.TrainingPlanRepository
import com.nickghignatti.tracker.domain.usecase.TrainingWeek
import com.nickghignatti.tracker.ui.components.EmptyState
import com.nickghignatti.tracker.ui.components.Hairline
import com.nickghignatti.tracker.ui.components.MenuItem
import com.nickghignatti.tracker.ui.components.OverflowMenu
import com.nickghignatti.tracker.ui.components.ProgressTrack
import com.nickghignatti.tracker.ui.components.SectionLabel
import com.nickghignatti.tracker.ui.components.SegmentedSwitcher
import com.nickghignatti.tracker.ui.components.TrackerButton
import com.nickghignatti.tracker.ui.components.TrackerCard
import com.nickghignatti.tracker.ui.components.TrackerTopBar
import com.nickghignatti.tracker.ui.exercises.CatalogAttribution
import com.nickghignatti.tracker.ui.exercises.ChipRow
import com.nickghignatti.tracker.ui.exercises.ExerciseLibraryUiState
import com.nickghignatti.tracker.ui.exercises.ExerciseLibraryViewModel
import com.nickghignatti.tracker.ui.exercises.ExerciseRow
import com.nickghignatti.tracker.ui.exercises.label
import com.nickghignatti.tracker.ui.format.displayName
import com.nickghignatti.tracker.ui.plans.PlanDialog
import com.nickghignatti.tracker.ui.plans.PlanDialogs
import com.nickghignatti.tracker.ui.plans.PlanLabel
import com.nickghignatti.tracker.ui.plans.PlanListAction
import com.nickghignatti.tracker.ui.plans.PlanListEvent
import com.nickghignatti.tracker.ui.plans.PlanListTexts
import com.nickghignatti.tracker.ui.plans.PlanListViewModel
import com.nickghignatti.tracker.ui.plans.recurrenceLabel
import com.nickghignatti.tracker.ui.plans.weekdaysSummary
import com.nickghignatti.tracker.ui.theme.ButtonKind
import com.nickghignatti.tracker.ui.theme.Tracker
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.LocalDate
import java.time.format.TextStyle
import javax.inject.Inject

@HiltViewModel
class TrainingPlansViewModel @Inject constructor(
    plans: TrainingPlanRepository,
) : PlanListViewModel<TrainingPlan>(plans)

private val texts = PlanListTexts(
    title = R.string.training_title,
    newPlan = R.string.training_new,
    defaultName = R.string.training_default_name,
    empty = R.string.training_empty,
    dailyDescription = R.string.training_daily_description,
    weeklyDescription = R.string.training_weekly_description,
    deleteMessage = R.string.training_delete_message,
)

private enum class WorkoutsTab { Plans, Library }

@Composable
fun TrainingPlansScreen(
    onOpenPlan: (Long) -> Unit,
    onOpenDay: (LocalDate) -> Unit,
    onOpenExercise: (catalogId: String) -> Unit,
    viewModel: TrainingPlansViewModel = hiltViewModel(),
    weekViewModel: TrainingWeekViewModel = hiltViewModel(),
    libraryViewModel: ExerciseLibraryViewModel = hiltViewModel(),
) {
    val plans by viewModel.uiState.collectAsStateWithLifecycle()
    val week by weekViewModel.uiState.collectAsStateWithLifecycle()
    val library by libraryViewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(viewModel) {
        viewModel.events.collect { event ->
            when (event) {
                is PlanListEvent.PlanCreated -> onOpenPlan(event.planId)
            }
        }
    }
    LaunchedEffect(weekViewModel) { weekViewModel.sessionStarted.collect(onOpenDay) }

    var tab by rememberSaveable { mutableStateOf(WorkoutsTab.Plans) }
    var dialog by remember { mutableStateOf<PlanDialog?>(null) }

    Scaffold(
        topBar = {
            TrackerTopBar(
                title = stringResource(R.string.workouts_title),
                actions = {
                    TrackerButton(
                        text = stringResource(texts.newPlan),
                        onClick = { dialog = PlanDialog.New },
                        icon = R.drawable.ic_add,
                        compact = true,
                    )
                },
            )
        },
    ) { padding ->
        Column(Modifier.padding(padding)) {
            SegmentedSwitcher(
                options = WorkoutsTab.entries,
                selected = tab,
                onSelect = { tab = it },
                label = {
                    stringResource(if (it == WorkoutsTab.Plans) R.string.workouts_tab_plans else R.string.workouts_tab_library)
                },
                modifier = Modifier.padding(Tracker.dimens.pageMargin),
            )
            when (tab) {
                WorkoutsTab.Plans -> PlansTab(
                    plans = plans.plans,
                    isLoading = plans.isLoading,
                    today = week.today,
                    week = week.week,
                    onOpenPlan = onOpenPlan,
                    onStartToday = weekViewModel::startToday,
                    onAction = viewModel::onAction,
                    onOpenDialog = { dialog = it },
                )
                WorkoutsTab.Library -> LibraryTab(libraryViewModel, library, onOpenExercise)
            }
        }
    }

    PlanDialogs(dialog, texts, viewModel::onAction, onDismiss = { dialog = null })
}

@Composable
private fun PlansTab(
    plans: List<TrainingPlan>,
    isLoading: Boolean,
    today: LocalDate,
    week: TrainingWeek?,
    onOpenPlan: (Long) -> Unit,
    onStartToday: () -> Unit,
    onAction: (PlanListAction) -> Unit,
    onOpenDialog: (PlanDialog) -> Unit,
) {
    if (isLoading) return
    if (plans.isEmpty()) {
        EmptyState(stringResource(texts.empty))
        return
    }
    LazyColumn(
        contentPadding = PaddingValues(start = Tracker.dimens.pageMargin, end = Tracker.dimens.pageMargin, bottom = Tracker.dimens.xl),
        verticalArrangement = Arrangement.spacedBy(Tracker.dimens.md),
    ) {
        item(key = "active-label") { SectionLabel(stringResource(R.string.workouts_active_program)) }
        item(key = "active") {
            if (week != null) {
                ActiveProgramCard(week, onOpen = { onOpenPlan(week.plan.id) }, onStartToday = onStartToday)
            } else {
                TrackerCard(Modifier.fillMaxWidth()) {
                    Text(stringResource(R.string.workouts_no_active), style = Tracker.type.bodyMd, color = Tracker.colors.inkSecondary)
                }
            }
        }
        item(key = "saved-label") {
            SectionLabel(
                stringResource(R.string.workouts_saved_plans),
                Modifier.padding(top = Tracker.dimens.md),
                trailing = stringResource(R.string.workouts_plan_count, plans.size),
            )
        }
        items(plans, key = { it.id }) { plan ->
            RoutineCard(
                plan = plan,
                today = today,
                canStart = plan.isActive && week?.hasPendingSessionToday == true,
                onOpen = { onOpenPlan(plan.id) },
                onStart = onStartToday,
                onAction = onAction,
                onOpenDialog = onOpenDialog,
            )
        }
    }
}

@Composable
private fun ActiveProgramCard(week: TrainingWeek, onOpen: () -> Unit, onStartToday: () -> Unit) {
    val planned = week.days.size
    TrackerCard(Modifier.fillMaxWidth(), onClick = onOpen) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.sm)) {
            PlanLabel(recurrenceLabel(week.plan.recurrence), highlighted = true)
        }
        Text(
            week.plan.name,
            style = Tracker.type.headlineMd,
            color = Tracker.colors.ink,
            modifier = Modifier.padding(top = Tracker.dimens.sm),
        )
        if (planned > 0) {
            Row(Modifier.fillMaxWidth().padding(top = Tracker.dimens.md), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    stringResource(R.string.workouts_sessions_completed, week.completedCount, planned),
                    style = Tracker.type.bodySm,
                    color = Tracker.colors.inkSecondary,
                )
                Text(
                    "${week.completedCount * PERCENT / planned}%",
                    style = Tracker.type.tabularCaption,
                    color = Tracker.colors.ink,
                )
            }
            ProgressTrack(
                fraction = week.completedCount.toFloat() / planned,
                modifier = Modifier.padding(vertical = Tracker.dimens.sm),
            )
            Row(
                Modifier.fillMaxWidth().padding(top = Tracker.dimens.sm),
                horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.sm),
            ) {
                week.days.forEach { day ->
                    DayBox(
                        label = day.date.dayOfWeek.displayName(TextStyle.SHORT),
                        completed = day.isCompleted,
                        isToday = day.isToday,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
        if (week.hasPendingSessionToday) {
            TrackerButton(
                text = stringResource(R.string.workouts_start_today),
                onClick = onStartToday,
                icon = R.drawable.ic_play,
                modifier = Modifier.fillMaxWidth().padding(top = Tracker.dimens.lg),
            )
        }
    }
}

private const val PERCENT = 100

@Composable
private fun DayBox(label: String, completed: Boolean, isToday: Boolean, modifier: Modifier = Modifier) {
    val colors = Tracker.colors
    val shape = Tracker.dimens.control
    Column(
        modifier
            .height(Tracker.dimens.buttonHeight + Tracker.dimens.md)
            .clip(shape)
            .border(
                if (isToday) Tracker.dimens.borderWidthFocused else Tracker.dimens.borderWidth,
                if (isToday) colors.ink else colors.border,
                shape,
            ),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Tracker.dimens.xs, Alignment.CenterVertically),
    ) {
        Text(label, style = Tracker.type.labelSm, color = if (isToday) colors.ink else colors.inkSecondary, maxLines = 1)
        Box(
            Modifier
                .size(Tracker.dimens.checkSize - Tracker.dimens.sm)
                .then(if (completed) Modifier else Modifier.border(Tracker.dimens.borderWidth, colors.inkTertiary, Tracker.dimens.chip)),
            contentAlignment = Alignment.Center,
        ) {
            if (completed) {
                Icon(painterResource(R.drawable.ic_check), contentDescription = null, tint = colors.accent)
            }
        }
    }
}

@Composable
private fun RoutineCard(
    plan: TrainingPlan,
    today: LocalDate,
    canStart: Boolean,
    onOpen: () -> Unit,
    onStart: () -> Unit,
    onAction: (PlanListAction) -> Unit,
    onOpenDialog: (PlanDialog) -> Unit,
) {
    TrackerCard(
        Modifier.fillMaxWidth(),
        onClick = onOpen,
        borderColor = if (plan.isActive) Tracker.colors.accent else Tracker.colors.border,
        contentPadding = PaddingValues(start = Tracker.dimens.lg, top = Tracker.dimens.md, end = Tracker.dimens.xs, bottom = Tracker.dimens.md),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(plan.name, style = Tracker.type.headlineMd, color = Tracker.colors.ink, modifier = Modifier.weight(1f))
            OverflowMenu(
                listOf(
                    if (plan.isActive) {
                        MenuItem(stringResource(R.string.plan_deactivate)) { onAction(PlanListAction.Deactivate) }
                    } else {
                        MenuItem(stringResource(R.string.plan_set_active)) { onAction(PlanListAction.Activate(plan.id)) }
                    },
                    MenuItem(stringResource(R.string.action_rename)) { onOpenDialog(PlanDialog.Rename(plan)) },
                    MenuItem(stringResource(R.string.action_delete)) { onOpenDialog(PlanDialog.Delete(plan)) },
                ),
            )
        }
        Column(Modifier.padding(end = Tracker.dimens.md), verticalArrangement = Arrangement.spacedBy(Tracker.dimens.sm)) {
            Text(trainingPlanSummary(plan), style = Tracker.type.bodyMd, color = Tracker.colors.inkSecondary)
            Row(horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.sm)) {
                PlanLabel(recurrenceLabel(plan.recurrence))
                if (plan.isActive) PlanLabel(stringResource(R.string.plan_active), highlighted = true)
            }
            Hairline(Modifier.padding(top = Tracker.dimens.xs))
            Row(verticalAlignment = Alignment.CenterVertically) {
                val next = plan.nextSessionFrom(today).firstOrNull()?.name
                Text(
                    next?.let { stringResource(R.string.workouts_next, it) }.orEmpty(),
                    style = Tracker.type.bodySm,
                    color = Tracker.colors.inkSecondary,
                    modifier = Modifier.weight(1f),
                )
                if (canStart) {
                    TrackerButton(stringResource(R.string.workouts_start), onStart, icon = R.drawable.ic_play, compact = true)
                } else {
                    TrackerButton(stringResource(R.string.workouts_open), onOpen, kind = ButtonKind.Secondary, compact = true)
                }
            }
        }
    }
}

@Composable
private fun LibraryTab(
    viewModel: ExerciseLibraryViewModel,
    state: ExerciseLibraryUiState,
    onOpenExercise: (String) -> Unit,
) {
    LazyColumn(contentPadding = PaddingValues(bottom = Tracker.dimens.xl)) {
        item {
            OutlinedTextField(
                value = state.query,
                onValueChange = viewModel::onQueryChanged,
                placeholder = { Text(stringResource(R.string.exercises_search_hint)) },
                leadingIcon = { Icon(painterResource(R.drawable.ic_search), contentDescription = null) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(horizontal = Tracker.dimens.pageMargin),
            )
        }
        item {
            ChipRow(Muscle.entries, selected = state.filter.muscle, label = { stringResource(it.label()) }) {
                viewModel.onToggleMuscle(it)
            }
        }
        item {
            ChipRow(Equipment.entries, selected = state.filter.equipment, label = { stringResource(it.label()) }) {
                viewModel.onToggleEquipment(it)
            }
        }
        item { Hairline(Modifier.padding(horizontal = Tracker.dimens.pageMargin, vertical = Tracker.dimens.sm)) }
        if (!state.isLoading && state.results.isEmpty()) {
            item {
                Text(
                    stringResource(R.string.exercises_none),
                    style = Tracker.type.bodyMd,
                    color = Tracker.colors.inkSecondary,
                    modifier = Modifier.padding(Tracker.dimens.lg),
                )
            }
        }
        items(state.results, key = { it.id }) { exercise ->
            ExerciseRow(exercise, onClick = { onOpenExercise(exercise.id) }, onInfo = { onOpenExercise(exercise.id) })
        }
        item { CatalogAttribution() }
    }
}

/** "4 exercises · 12 sets" for a daily plan, "Mon · Wed · Fri" for a weekly one. */
@Composable
private fun trainingPlanSummary(plan: TrainingPlan): String = when {
    plan.trainingDays.isEmpty() -> stringResource(R.string.training_summary_empty)
    plan.recurrence == Recurrence.WEEKLY -> weekdaysSummary(plan.trainingDays)
    else -> {
        val exercises = plan.sessionOn(PlanDay.EveryDay)
        val sets = exercises.sumOf { it.sets.size }
        stringResource(
            R.string.plan_summary,
            pluralStringResource(R.plurals.exercise_count, exercises.size, exercises.size),
            pluralStringResource(R.plurals.set_count, sets, sets),
        )
    }
}
