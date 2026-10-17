package com.nickghignatti.tracker.ui.today

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.CalorieDay
import com.nickghignatti.tracker.domain.model.DayAgenda
import com.nickghignatti.tracker.domain.model.Exercise
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.ExerciseSet
import com.nickghignatti.tracker.domain.model.Food
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.domain.model.MealLog
import com.nickghignatti.tracker.domain.model.Nutrients
import com.nickghignatti.tracker.domain.model.PendingSession
import com.nickghignatti.tracker.domain.model.Workout
import com.nickghignatti.tracker.ui.components.CheckTarget
import com.nickghignatti.tracker.ui.components.Hairline
import com.nickghignatti.tracker.ui.components.MacroTile
import com.nickghignatti.tracker.ui.components.ProgressTrack
import com.nickghignatti.tracker.ui.components.SectionLabel
import com.nickghignatti.tracker.ui.components.TrackerButton
import com.nickghignatti.tracker.ui.components.TrackerCard
import com.nickghignatti.tracker.ui.components.TrackerChip
import com.nickghignatti.tracker.ui.components.TrackerTopBar
import com.nickghignatti.tracker.ui.format.formatted
import com.nickghignatti.tracker.ui.format.setsSummary
import com.nickghignatti.tracker.ui.theme.ButtonKind
import com.nickghignatti.tracker.ui.theme.Macro
import com.nickghignatti.tracker.ui.theme.Tracker
import com.nickghignatti.tracker.ui.theme.TrackerTheme
import java.text.NumberFormat
import java.time.LocalDate
import java.time.format.FormatStyle
import kotlin.math.roundToInt

@Composable
fun TodayScreen(
    onOpenDay: (LocalDate) -> Unit,
    onOpenTraining: () -> Unit,
    onOpenDiet: () -> Unit,
    onOpenCalories: () -> Unit,
    onOpenProfile: () -> Unit,
    viewModel: TodayViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(viewModel) {
        viewModel.events.collect { event ->
            when (event) {
                is TodayEvent.SessionStarted -> onOpenDay(event.date)
            }
        }
    }

    TodayScreen(state, viewModel::onAction, onOpenDay, onOpenTraining, onOpenDiet, onOpenCalories, onOpenProfile)
}

@Composable
internal fun TodayScreen(
    state: TodayUiState,
    onAction: (TodayAction) -> Unit,
    onOpenDay: (LocalDate) -> Unit,
    onOpenTraining: () -> Unit,
    onOpenDiet: () -> Unit,
    onOpenCalories: () -> Unit = {},
    onOpenProfile: () -> Unit = {},
) {
    val agenda = state.agenda
    Scaffold(
        topBar = {
            TrackerTopBar(
                title = stringResource(R.string.today_title),
                subtitle = state.date.formatted(FormatStyle.FULL),
                navigation = {
                    Icon(painterResource(R.drawable.ic_calendar), contentDescription = null, tint = Tracker.colors.ink)
                },
            )
        },
    ) { padding ->
        if (state.isLoading) return@Scaffold
        LazyColumn(
            modifier = Modifier.padding(padding),
            contentPadding = PaddingValues(Tracker.dimens.pageMargin),
            verticalArrangement = Arrangement.spacedBy(Tracker.dimens.md),
        ) {
            item(key = "energy") { EnergyCard(state.calories, state.targets?.nutrients) }

            item(key = "training-label") {
                SectionLabel(stringResource(R.string.today_section_training), Modifier.padding(top = Tracker.dimens.md))
            }
            agenda.pendingSession?.let { session ->
                item(key = "pending") {
                    TrainingCard(
                        title = session.title,
                        subtitle = pluralStringResource(R.plurals.today_exercise_count, session.exercises.size, session.exercises.size),
                        rows = session.exercises.map { TrainingRow(it.name, setsSummary(it.sets)) },
                        actionText = stringResource(R.string.pending_start),
                        onAction = { onAction(TodayAction.StartPlannedSession) },
                    )
                }
            }
            // Workouts and meals come from different tables, so ids overlap: namespace the keys.
            items(agenda.workouts, key = { "workout-${it.id}" }) { workout ->
                TrainingCard(
                    title = workout.title,
                    subtitle = if (workout.totalSets > 0) {
                        stringResource(R.string.today_sets_done, workout.doneSets, workout.totalSets)
                    } else {
                        pluralStringResource(R.plurals.today_exercise_count, workout.exercises.size, workout.exercises.size)
                    },
                    rows = workout.exercises.map {
                        TrainingRow(it.name, stringResource(R.string.today_exercise_progress, it.doneSets, it.sets.size))
                    },
                    actionText = stringResource(R.string.today_continue_workout),
                    onAction = { onOpenDay(state.date) },
                )
            }
            if (agenda.workouts.isEmpty() && agenda.pendingSession == null) {
                item(key = "training-empty") {
                    if (agenda.hasTrainingPlan) {
                        Placeholder(
                            text = stringResource(R.string.today_rest_day),
                            action = stringResource(R.string.today_add_workout),
                            onAction = { onOpenDay(state.date) },
                        )
                    } else {
                        Placeholder(
                            text = stringResource(R.string.today_no_training_plan),
                            action = stringResource(R.string.today_choose_training_plan),
                            onAction = onOpenTraining,
                        )
                    }
                }
            }

            val meals = state.calories.meals
            val planned = meals.filter { it.planned != null }
            item(key = "nutrition-label") {
                SectionLabel(
                    stringResource(R.string.today_section_nutrition),
                    Modifier.padding(top = Tracker.dimens.md),
                    trailing = planned.takeIf { it.isNotEmpty() }?.let {
                        stringResource(R.string.today_meals_logged, it.count { meal -> meal.entries.isNotEmpty() }, it.size)
                    },
                )
            }
            if (planned.isEmpty()) {
                item(key = "nutrition-empty") {
                    Placeholder(
                        text = stringResource(if (agenda.hasDietPlan) R.string.today_no_meals else R.string.today_no_diet_plan),
                        action = stringResource(if (agenda.hasDietPlan) R.string.today_edit_diet else R.string.today_choose_diet),
                        onAction = onOpenDiet,
                    )
                }
            } else {
                item(key = "nutrition") {
                    TrackerCard(Modifier.fillMaxWidth(), contentPadding = PaddingValues(0.dp)) {
                        planned.forEachIndexed { index, meal ->
                            if (index > 0) Hairline()
                            MealChecklistRow(meal, onLog = { meal.planned?.let { onAction(TodayAction.LogMeal(it)) } })
                        }
                    }
                }
            }

            item(key = "quick-label") {
                SectionLabel(stringResource(R.string.today_section_quick), Modifier.padding(top = Tracker.dimens.md))
            }
            item(key = "quick") {
                Row(horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.sm)) {
                    QuickAction(
                        stringResource(R.string.today_quick_food),
                        stringResource(R.string.today_quick_food_hint),
                        onOpenCalories,
                        Modifier.weight(1f),
                    )
                    QuickAction(
                        stringResource(R.string.today_quick_weight),
                        stringResource(R.string.today_quick_weight_hint),
                        onOpenProfile,
                        Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

private fun kcalNumber(kcal: Double): String = NumberFormat.getIntegerInstance().format(kcal.roundToInt())

@Composable
private fun EnergyCard(day: CalorieDay, goal: Nutrients?) {
    val eaten = day.eaten
    // The profile's goal is the target; without one, the diet's plan is.
    val target = goal ?: day.planned
    TrackerCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                stringResource(R.string.today_energy_consumed).uppercase(),
                style = Tracker.type.labelSm,
                color = Tracker.colors.inkSecondary,
                modifier = Modifier.weight(1f).padding(bottom = Tracker.dimens.xs),
            )
            Text(kcalNumber(eaten.kcal), style = Tracker.type.metricXl, color = Tracker.colors.ink)
            if (target != null) {
                Text(
                    " " + stringResource(R.string.today_of_goal, kcalNumber(target.kcal)),
                    style = Tracker.type.bodyMd,
                    color = Tracker.colors.inkSecondary,
                    modifier = Modifier.padding(bottom = Tracker.dimens.xs),
                )
            }
        }
        if (target != null && target.kcal > 0) {
            ProgressTrack(
                fraction = (eaten.kcal / target.kcal).toFloat(),
                color = if (eaten.kcal <= target.kcal) Tracker.colors.accent else Tracker.colors.danger,
                modifier = Modifier.padding(vertical = Tracker.dimens.md),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.sm)) {
            MacroSlot(Macro.Protein, R.string.label_protein, eaten.protein, target?.protein, Modifier.weight(1f))
            MacroSlot(Macro.Carbs, R.string.label_carbs, eaten.carbs, target?.carbs, Modifier.weight(1f))
            MacroSlot(Macro.Fat, R.string.label_fat, eaten.fat, target?.fat, Modifier.weight(1f))
        }
    }
}

@Composable
private fun MacroSlot(macro: Macro, label: Int, eaten: Double, target: Double?, modifier: Modifier) {
    val fraction = if (target != null && target > 0) (eaten / target).toFloat() else 0f
    MacroTile(
        macro = macro,
        name = stringResource(label),
        value = stringResource(R.string.grams_value, eaten.roundToInt()),
        target = target?.let { stringResource(R.string.grams_value, it.roundToInt()) } ?: "–",
        fraction = fraction,
        percentText = target?.takeIf { it > 0 }?.let { "${(fraction * 100).roundToInt()}%" },
        modifier = modifier,
    )
}

private data class TrainingRow(val name: String, val detail: String)

@Composable
private fun TrainingCard(
    title: String,
    subtitle: String,
    rows: List<TrainingRow>,
    actionText: String,
    onAction: () -> Unit,
) {
    TrackerCard(Modifier.fillMaxWidth()) {
        Text(title, style = Tracker.type.headlineLg, color = Tracker.colors.ink)
        Text(subtitle, style = Tracker.type.bodyMd, color = Tracker.colors.inkSecondary)
        Column(Modifier.padding(top = Tracker.dimens.md)) {
            rows.forEachIndexed { index, row ->
                Hairline()
                Row(
                    Modifier.fillMaxWidth().heightIn(min = Tracker.dimens.rowMinHeight + Tracker.dimens.md),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.md),
                ) {
                    Text("%02d".format(index + 1), style = Tracker.type.tabularCaption, color = Tracker.colors.inkTertiary)
                    Text(row.name, style = Tracker.type.bodyLg, color = Tracker.colors.ink, modifier = Modifier.weight(1f))
                    TrackerChip(row.detail)
                }
            }
        }
        TrackerButton(
            text = actionText,
            onClick = onAction,
            icon = R.drawable.ic_play,
            modifier = Modifier.fillMaxWidth().padding(top = Tracker.dimens.md),
        )
    }
}

@Composable
private fun MealChecklistRow(meal: MealLog, onLog: () -> Unit) {
    val logged = meal.entries.isNotEmpty()
    val kcal = if (logged) meal.eaten.kcal else meal.planned?.nutrients?.kcal
    Row(
        Modifier.fillMaxWidth().padding(Tracker.dimens.lg),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.md),
    ) {
        CheckTarget(
            checked = logged,
            onCheckedChange = if (!logged && meal.canLogAsPlanned) ({ onLog() }) else null,
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Tracker.dimens.xs)) {
            Row(horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.sm)) {
                Text(meal.name, style = Tracker.type.labelMd, color = Tracker.colors.ink)
                meal.planned?.time?.takeIf { it.isNotBlank() }?.let {
                    Text(it, style = Tracker.type.tabularCaption, color = Tracker.colors.inkSecondary)
                }
            }
            val foods = if (logged) meal.entries.map { it.portion.food.name } else meal.planned?.foods.orEmpty().map { it.name }
            Text(
                foods.joinToString(", "),
                style = Tracker.type.bodyMd,
                color = if (logged) Tracker.colors.inkSecondary else Tracker.colors.ink,
                textDecoration = if (logged) TextDecoration.LineThrough else null,
            )
        }
        if (kcal != null) {
            Text(
                stringResource(R.string.kcal_value, kcal.roundToInt()),
                style = Tracker.type.labelMd,
                color = Tracker.colors.ink,
            )
        }
    }
}

@Composable
private fun QuickAction(title: String, hint: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    TrackerCard(modifier, onClick = onClick) {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Tracker.dimens.xs)) {
                Text(title, style = Tracker.type.labelMd, color = Tracker.colors.ink)
                Text(hint, style = Tracker.type.bodySm, color = Tracker.colors.inkSecondary)
            }
        }
    }
}

@Composable
private fun Placeholder(text: String, action: String, onAction: () -> Unit) {
    TrackerCard(Modifier.fillMaxWidth()) {
        Text(text, style = Tracker.type.bodyLg, color = Tracker.colors.ink)
        TrackerButton(
            text = action,
            onClick = onAction,
            kind = ButtonKind.Secondary,
            compact = true,
            modifier = Modifier.padding(top = Tracker.dimens.md),
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun TodayScreenPreview() {
    val today = LocalDate.of(2026, 9, 26)
    val squat = Exercise(
        id = 1,
        name = "Squat",
        notes = "",
        sets = List(3) { ExerciseSet(id = it.toLong(), plannedReps = 5, plannedWeight = 100.0, done = it == 0) },
    )
    val breakfast = Meal(1, "Breakfast", "08:00", listOf(Food(1, "Oats", "80 g")))
    TrackerTheme {
        TodayScreen(
            state = TodayUiState(
                agenda = DayAgenda(
                    date = today,
                    workouts = listOf(Workout(1, today, "Legs", listOf(squat))),
                    pendingSession = PendingSession(1, "Push", listOf(ExercisePlan.uniform("Bench press", "", 3, 8, 60.0))),
                    meals = listOf(breakfast),
                    hasTrainingPlan = true,
                    hasDietPlan = true,
                ),
                calories = CalorieDay(today, listOf(MealLog("Breakfast", breakfast)), hasDietPlan = true),
                isLoading = false,
            ),
            onAction = {},
            onOpenDay = {},
            onOpenTraining = {},
            onOpenDiet = {},
        )
    }
}
