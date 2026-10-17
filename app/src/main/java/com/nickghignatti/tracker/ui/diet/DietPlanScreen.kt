@file:OptIn(ExperimentalMaterial3Api::class)

package com.nickghignatti.tracker.ui.diet

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import com.nickghignatti.tracker.ui.components.SectionLabel
import com.nickghignatti.tracker.ui.components.TrackerCard
import com.nickghignatti.tracker.ui.theme.Macro
import com.nickghignatti.tracker.ui.theme.Tracker
import kotlin.math.roundToInt
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.ui.components.TrackerFab
import com.nickghignatti.tracker.ui.components.TrackerTopBar
import com.nickghignatti.tracker.ui.components.TrackerBackButton
import com.nickghignatti.tracker.domain.model.Food
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.domain.model.Nutrients
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.ui.components.ConfirmDeleteDialog
import com.nickghignatti.tracker.ui.components.EmptyState
import com.nickghignatti.tracker.ui.components.MenuItem
import com.nickghignatti.tracker.ui.components.OverflowMenu
import com.nickghignatti.tracker.ui.food.AmountDialog
import com.nickghignatti.tracker.ui.food.kcalLabel
import com.nickghignatti.tracker.ui.format.displayName
import com.nickghignatti.tracker.ui.plans.WeekdayTabs
import com.nickghignatti.tracker.ui.plans.rememberLocalWeek
import com.nickghignatti.tracker.ui.plans.recurrenceLabel

/** Which dialog is open; transient UI state, so it lives in the screen, not the ViewModel. */
private sealed interface DietDialog {
    data class NewMeal(val day: PlanDay) : DietDialog
    data class EditMeal(val meal: Meal) : DietDialog
    data class DeleteMeal(val meal: Meal) : DietDialog
    data class EditFood(val food: Food) : DietDialog
    data object CopyDay : DietDialog
}

@Composable
fun DietPlanScreen(onBack: () -> Unit, onAddFood: (Meal) -> Unit, viewModel: DietPlanViewModel) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    DietPlanScreen(state, viewModel::onAction, onBack, onAddFood)
}

@Composable
internal fun DietPlanScreen(
    state: DietPlanUiState,
    onAction: (DietPlanAction) -> Unit,
    onBack: () -> Unit,
    onAddFood: (Meal) -> Unit,
) {
    val plan = state.plan
    if (!state.isLoading && plan == null) {
        // Deleted elsewhere: nothing left to edit.
        LaunchedEffect(Unit) { onBack() }
        return
    }
    var dialog by remember { mutableStateOf<DietDialog?>(null) }
    val week = rememberLocalWeek()
    val isWeekly = plan?.recurrence == Recurrence.WEEKLY
    val dayName = state.selectedDay.displayName()

    Scaffold(
        topBar = {
            TrackerTopBar(
                title = plan?.name.orEmpty(),
                subtitle = plan?.let { recurrenceLabel(it.recurrence) },
                navigation = { TrackerBackButton(onBack) },
                actions = {
                    if (isWeekly) {
                        OverflowMenu(listOf(MenuItem(stringResource(R.string.diet_copy_day, dayName)) { dialog = DietDialog.CopyDay }))
                    }
                },
            )
        },
        floatingActionButton = {
            state.planDay?.let { day ->
                TrackerFab(stringResource(R.string.diet_add_meal), onClick = { dialog = DietDialog.NewMeal(day) })
            }
        },
    ) { padding ->
        if (plan == null) return@Scaffold
        Column(Modifier.padding(padding)) {
            if (isWeekly) {
                WeekdayTabs(
                    selected = state.selectedDay,
                    today = state.today,
                    onSelect = { onAction(DietPlanAction.SelectDay(it)) },
                )
            }
            if (state.meals.isEmpty()) {
                EmptyState(
                    if (isWeekly) stringResource(R.string.diet_empty, dayName) else stringResource(R.string.diet_plan_empty_daily),
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, top = 16.dp, end = 16.dp, bottom = 96.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    state.planDay?.let(plan::nutrientsOn)?.let { total ->
                        item(key = "total") { DailyBudget(total) }
                    }
                    items(state.meals, key = { it.id }) { meal ->
                        MealCard(
                            meal = meal,
                            actions = MealCardActions(
                                onEditMeal = { dialog = DietDialog.EditMeal(it) },
                                onDeleteMeal = { dialog = DietDialog.DeleteMeal(it) },
                                onAddFood = onAddFood,
                                onEditFood = { dialog = DietDialog.EditFood(it) },
                            ),
                        )
                    }
                }
            }
        }
    }

    val dismiss = { dialog = null }
    val act = { action: DietPlanAction ->
        onAction(action)
        dismiss()
    }
    when (val current = dialog) {
        null -> Unit
        is DietDialog.NewMeal -> MealDialog(
            existing = null,
            onSave = { name, time -> act(DietPlanAction.AddMeal(current.day, name, time)) },
            onDismiss = dismiss,
        )
        is DietDialog.EditMeal -> MealDialog(
            existing = current.meal,
            onSave = { name, time -> act(DietPlanAction.UpdateMeal(current.meal.id, name, time)) },
            onDismiss = dismiss,
        )
        is DietDialog.DeleteMeal -> ConfirmDeleteDialog(
            title = stringResource(R.string.dialog_delete_meal_title),
            message = stringResource(R.string.dialog_delete_meal_message, current.meal.name),
            onConfirm = { act(DietPlanAction.DeleteMeal(current.meal.id)) },
            onDismiss = dismiss,
        )
        is DietDialog.EditFood -> current.food.portion?.let { portion ->
            AmountDialog(
                food = portion.food,
                initialGrams = portion.grams,
                confirmLabel = stringResource(R.string.action_save),
                onConfirm = { act(DietPlanAction.UpdateLinkedFood(current.food.id, portion.copy(grams = it))) },
                onDelete = { act(DietPlanAction.DeleteFood(current.food.id)) },
                onDismiss = dismiss,
            )
        } ?: FoodDialog(
            title = stringResource(R.string.dialog_edit_food_title),
            existing = current.food,
            onSave = { name, quantity -> act(DietPlanAction.UpdateFood(current.food.id, name, quantity)) },
            onDelete = { act(DietPlanAction.DeleteFood(current.food.id)) },
            onDismiss = dismiss,
        )
        DietDialog.CopyDay -> CopyDayDialog(
            source = state.selectedDay,
            week = week,
            onCopy = { act(DietPlanAction.CopyDay(state.selectedDay, it)) },
            onDismiss = dismiss,
        )
    }
}

/** The day's planned energy, split by where it comes from, with each macro's grams and kcal. */
@Composable
private fun DailyBudget(total: Nutrients) {
    val shares = listOf(
        Triple(Macro.Protein, total.protein, total.protein * KCAL_PER_G_PROTEIN),
        Triple(Macro.Carbs, total.carbs, total.carbs * KCAL_PER_G_CARBS),
        Triple(Macro.Fat, total.fat, total.fat * KCAL_PER_G_FAT),
    )
    val macroKcal = shares.sumOf { it.third }
    TrackerCard(Modifier.fillMaxWidth()) {
        SectionLabel(stringResource(R.string.diet_daily_budget))
        Row(Modifier.padding(top = Tracker.dimens.xs), verticalAlignment = Alignment.Bottom) {
            Text(total.kcal.roundToInt().let { "%,d".format(it) }, style = Tracker.type.metricXl, color = Tracker.colors.ink)
            Text(
                " " + stringResource(R.string.unit_kcal),
                style = Tracker.type.bodyMd,
                color = Tracker.colors.inkSecondary,
                modifier = Modifier.padding(bottom = Tracker.dimens.xs),
            )
        }
        if (macroKcal > 0) {
            Row(
                Modifier
                    .padding(vertical = Tracker.dimens.md)
                    .fillMaxWidth()
                    .height(Tracker.dimens.progressThicknessThin * 2)
                    .clip(CircleShape),
            ) {
                shares.forEach { (macro, _, kcal) ->
                    if (kcal > 0) Box(Modifier.weight(kcal.toFloat()).fillMaxHeight().background(Tracker.styles.macro(macro)))
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.sm)) {
            shares.forEach { (macro, grams, kcal) ->
                BudgetTile(macro, macroName(macro), grams, kcal, Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun BudgetTile(macro: Macro, name: String, grams: Double, kcal: Double, modifier: Modifier = Modifier) {
    Column(
        modifier
            .clip(Tracker.dimens.control)
            .background(Tracker.colors.surfaceMuted)
            .padding(Tracker.dimens.md),
    ) {
        Text(name, style = Tracker.type.labelMd, color = Tracker.styles.macro(macro))
        Text(stringResource(R.string.grams_value, grams.roundToInt()), style = Tracker.type.bodyLg, color = Tracker.colors.ink)
        Text(kcalLabel(kcal), style = Tracker.type.tabularCaption, color = Tracker.colors.inkSecondary)
    }
}

@Composable
private fun macroName(macro: Macro): String = stringResource(
    when (macro) {
        Macro.Protein -> R.string.label_protein
        Macro.Carbs -> R.string.label_carbs
        Macro.Fat -> R.string.label_fat
    },
)

private const val KCAL_PER_G_PROTEIN = 4.0
private const val KCAL_PER_G_CARBS = 4.0
private const val KCAL_PER_G_FAT = 9.0
