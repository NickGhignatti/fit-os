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
import androidx.compose.material3.PrimaryScrollableTabRow
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.Food
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.ui.calendar.orderedWeek
import com.nickghignatti.tracker.ui.components.ConfirmDeleteDialog
import com.nickghignatti.tracker.ui.components.EmptyState
import com.nickghignatti.tracker.ui.components.MenuItem
import com.nickghignatti.tracker.ui.components.OverflowMenu
import com.nickghignatti.tracker.ui.format.displayName
import java.time.format.TextStyle
import java.time.temporal.WeekFields
import java.util.Locale

/** Which dialog is open; transient UI state, so it lives in the screen, not the ViewModel. */
private sealed interface DietDialog {
    data object NewMeal : DietDialog
    data class EditMeal(val meal: Meal) : DietDialog
    data class DeleteMeal(val meal: Meal) : DietDialog
    data class NewFood(val meal: Meal) : DietDialog
    data class EditFood(val food: Food) : DietDialog
    data object CopyDay : DietDialog
}

@Composable
fun DietScreen(viewModel: DietViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    DietScreen(state, viewModel::onAction)
}

@Composable
internal fun DietScreen(state: DietUiState, onAction: (DietAction) -> Unit) {
    var dialog by remember { mutableStateOf<DietDialog?>(null) }
    val locale = Locale.getDefault()
    val week = remember(locale) { orderedWeek(WeekFields.of(locale).firstDayOfWeek) }
    val dayName = state.selectedDay.displayName()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.diet_title)) },
                actions = {
                    OverflowMenu(listOf(MenuItem(stringResource(R.string.diet_copy_day, dayName)) { dialog = DietDialog.CopyDay }))
                },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { dialog = DietDialog.NewMeal },
                icon = { Icon(painterResource(R.drawable.ic_add), contentDescription = null) },
                text = { Text(stringResource(R.string.diet_add_meal)) },
            )
        },
    ) { padding ->
        Column(Modifier.padding(padding)) {
            PrimaryScrollableTabRow(selectedTabIndex = week.indexOf(state.selectedDay), edgePadding = 8.dp) {
                week.forEach { day ->
                    val label = day.displayName(TextStyle.SHORT)
                    Tab(
                        selected = day == state.selectedDay,
                        onClick = { onAction(DietAction.SelectDay(day)) },
                        text = { Text(if (day == state.today) stringResource(R.string.today_tab_marker, label) else label) },
                    )
                }
            }
            when {
                state.isLoading -> Unit
                state.meals.isEmpty() -> EmptyState(stringResource(R.string.diet_empty, dayName))
                else -> LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, top = 16.dp, end = 16.dp, bottom = 96.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(state.meals, key = { it.id }) { meal ->
                        MealCard(
                            meal = meal,
                            actions = MealCardActions(
                                onEditMeal = { dialog = DietDialog.EditMeal(it) },
                                onDeleteMeal = { dialog = DietDialog.DeleteMeal(it) },
                                onAddFood = { dialog = DietDialog.NewFood(it) },
                                onEditFood = { dialog = DietDialog.EditFood(it) },
                            ),
                        )
                    }
                }
            }
        }
    }

    val dismiss = { dialog = null }
    val act = { action: DietAction ->
        onAction(action)
        dismiss()
    }
    when (val current = dialog) {
        null -> Unit
        DietDialog.NewMeal -> MealDialog(
            existing = null,
            onSave = { name, time -> act(DietAction.AddMeal(name, time)) },
            onDismiss = dismiss,
        )
        is DietDialog.EditMeal -> MealDialog(
            existing = current.meal,
            onSave = { name, time -> act(DietAction.UpdateMeal(current.meal.id, name, time)) },
            onDismiss = dismiss,
        )
        is DietDialog.DeleteMeal -> ConfirmDeleteDialog(
            title = stringResource(R.string.dialog_delete_meal_title),
            message = stringResource(R.string.dialog_delete_meal_message, current.meal.name, current.meal.day.displayName()),
            onConfirm = { act(DietAction.DeleteMeal(current.meal.id)) },
            onDismiss = dismiss,
        )
        is DietDialog.NewFood -> FoodDialog(
            title = stringResource(R.string.dialog_add_food_title, current.meal.name),
            existing = null,
            onSave = { name, quantity -> act(DietAction.AddFood(current.meal.id, name, quantity)) },
            onDelete = null,
            onDismiss = dismiss,
        )
        is DietDialog.EditFood -> FoodDialog(
            title = stringResource(R.string.dialog_edit_food_title),
            existing = current.food,
            onSave = { name, quantity -> act(DietAction.UpdateFood(current.food.id, name, quantity)) },
            onDelete = { act(DietAction.DeleteFood(current.food.id)) },
            onDismiss = dismiss,
        )
        DietDialog.CopyDay -> CopyDayDialog(
            source = state.selectedDay,
            week = week,
            onCopy = { act(DietAction.CopyDay(it)) },
            onDismiss = dismiss,
        )
    }
}
