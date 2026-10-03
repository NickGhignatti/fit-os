@file:OptIn(ExperimentalMaterial3Api::class)

package com.nickghignatti.tracker.ui.diet

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
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
import com.nickghignatti.tracker.ui.food.macrosLabel
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
            TopAppBar(
                title = {
                    Column {
                        Text(plan?.name.orEmpty())
                        if (plan != null) {
                            Text(
                                recurrenceLabel(plan.recurrence),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(painterResource(R.drawable.ic_arrow_back), stringResource(R.string.action_back))
                    }
                },
                actions = {
                    if (isWeekly) {
                        OverflowMenu(listOf(MenuItem(stringResource(R.string.diet_copy_day, dayName)) { dialog = DietDialog.CopyDay }))
                    }
                },
            )
        },
        floatingActionButton = {
            state.planDay?.let { day ->
                ExtendedFloatingActionButton(
                    onClick = { dialog = DietDialog.NewMeal(day) },
                    icon = { Icon(painterResource(R.drawable.ic_add), contentDescription = null) },
                    text = { Text(stringResource(R.string.diet_add_meal)) },
                )
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
                        item(key = "total") { DayTotal(total) }
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

@Composable
private fun DayTotal(total: Nutrients) {
    Column {
        Text(stringResource(R.string.diet_day_total, kcalLabel(total.kcal)), style = MaterialTheme.typography.titleMedium)
        Text(macrosLabel(total), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
