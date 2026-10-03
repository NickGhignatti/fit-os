@file:OptIn(ExperimentalMaterial3Api::class)

package com.nickghignatti.tracker.ui.calories

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.CalorieDay
import com.nickghignatti.tracker.domain.model.Food
import com.nickghignatti.tracker.domain.model.FoodId
import com.nickghignatti.tracker.domain.model.FoodItem
import com.nickghignatti.tracker.domain.model.FoodLogEntry
import com.nickghignatti.tracker.domain.model.FoodSource
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.domain.model.MealLog
import com.nickghignatti.tracker.domain.model.Nutrients
import com.nickghignatti.tracker.domain.model.Portion
import com.nickghignatti.tracker.ui.food.AmountDialog
import com.nickghignatti.tracker.ui.food.foodOriginLabel
import com.nickghignatti.tracker.ui.food.kcalLabel
import com.nickghignatti.tracker.ui.food.portionLabel
import com.nickghignatti.tracker.ui.format.formatted
import com.nickghignatti.tracker.ui.theme.TrackerTheme
import java.time.LocalDate
import java.time.format.FormatStyle
import kotlin.math.roundToInt

@Composable
fun CaloriesScreen(
    onAddFood: (date: LocalDate, meal: String) -> Unit,
    viewModel: CaloriesViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    CaloriesScreen(state, viewModel::onAction, onAddFood)
}

@Composable
internal fun CaloriesScreen(
    state: CaloriesUiState,
    onAction: (CaloriesAction) -> Unit,
    onAddFood: (date: LocalDate, meal: String) -> Unit,
) {
    var editing by remember { mutableStateOf<FoodLogEntry?>(null) }

    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.calories_title)) }) }) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { DayNavigator(state, onAction) }
            if (state.isLoading) return@LazyColumn
            item { SummaryCard(state.day) }
            items(state.day.meals, key = { it.name }) { meal ->
                MealLogCard(
                    meal = meal,
                    onAddFood = { onAddFood(state.date, meal.name) },
                    onLogAsPlanned = { meal.planned?.let { onAction(CaloriesAction.LogAsPlanned(it)) } },
                    onEditEntry = { editing = it },
                )
            }
        }
    }

    editing?.let { entry ->
        val dismiss = { editing = null }
        AmountDialog(
            food = entry.portion.food,
            initialGrams = entry.portion.grams,
            confirmLabel = stringResource(R.string.action_save),
            onConfirm = { onAction(CaloriesAction.UpdateGrams(entry.id, it)); dismiss() },
            onDelete = { onAction(CaloriesAction.DeleteEntry(entry.id)); dismiss() },
            onDismiss = dismiss,
        )
    }
}

@Composable
private fun DayNavigator(state: CaloriesUiState, onAction: (CaloriesAction) -> Unit) {
    val label = when (state.date) {
        state.today -> stringResource(R.string.calories_today)
        state.today.minusDays(1) -> stringResource(R.string.calories_yesterday)
        state.today.plusDays(1) -> stringResource(R.string.calories_tomorrow)
        else -> state.date.formatted(FormatStyle.MEDIUM)
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = { onAction(CaloriesAction.PreviousDay) }) {
            Icon(painterResource(R.drawable.ic_chevron_left), stringResource(R.string.calories_previous_day))
        }
        Text(
            label,
            style = MaterialTheme.typography.titleMedium,
            textAlign = TextAlign.Center,
            modifier = Modifier.weight(1f).clickable { onAction(CaloriesAction.GoToToday) },
        )
        IconButton(onClick = { onAction(CaloriesAction.NextDay) }) {
            Icon(painterResource(R.drawable.ic_chevron_right), stringResource(R.string.calories_next_day))
        }
    }
}

@Composable
private fun SummaryCard(day: CalorieDay) {
    val eaten = day.eaten
    val planned = day.planned
    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.Bottom) {
                Text(kcalLabel(eaten.kcal), style = MaterialTheme.typography.headlineMedium)
                Spacer(Modifier.width(8.dp))
                Text(
                    if (planned != null) stringResource(R.string.calories_of_planned, kcalLabel(planned.kcal)) else stringResource(R.string.calories_eaten),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 4.dp),
                )
            }
            if (planned != null && planned.kcal > 0) {
                LinearProgressIndicator(
                    progress = { (eaten.kcal / planned.kcal).toFloat().coerceIn(0f, 1f) },
                    modifier = Modifier.fillMaxWidth(),
                )
                val difference = (planned.kcal - eaten.kcal).roundToInt()
                Text(
                    if (difference >= 0) stringResource(R.string.calories_left, difference) else stringResource(R.string.calories_over, -difference),
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (difference >= 0) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.error,
                )
            } else if (!day.hasDietPlan) {
                Text(
                    stringResource(R.string.calories_no_plan_hint),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Row(Modifier.padding(top = 4.dp)) {
                Macro(stringResource(R.string.label_protein), eaten.protein, planned?.protein, Modifier.weight(1f))
                Macro(stringResource(R.string.label_carbs), eaten.carbs, planned?.carbs, Modifier.weight(1f))
                Macro(stringResource(R.string.label_fat), eaten.fat, planned?.fat, Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun Macro(label: String, eaten: Double, planned: Double?, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            if (planned != null) {
                stringResource(R.string.grams_of_planned, eaten.roundToInt(), planned.roundToInt())
            } else {
                stringResource(R.string.grams_value, eaten.roundToInt())
            },
            style = MaterialTheme.typography.titleMedium,
        )
    }
}

@Composable
private fun MealLogCard(
    meal: MealLog,
    onAddFood: () -> Unit,
    onLogAsPlanned: () -> Unit,
    onEditEntry: (FoodLogEntry) -> Unit,
) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(vertical = 12.dp)) {
            Row(Modifier.padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(meal.name, style = MaterialTheme.typography.titleMedium)
                    meal.planned?.time?.takeIf { it.isNotBlank() }?.let {
                        Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                if (meal.entries.isNotEmpty()) {
                    Text(kcalLabel(meal.eaten.kcal), style = MaterialTheme.typography.titleMedium)
                } else {
                    meal.planned?.nutrients?.let {
                        Text(
                            stringResource(R.string.calories_planned_value, kcalLabel(it.kcal)),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            meal.entries.forEach { entry -> EntryRow(entry, onClick = { onEditEntry(entry) }) }
            if (meal.canLogAsPlanned) {
                PlannedFoods(meal.planned!!.foods)
                FilledTonalButton(onClick = onLogAsPlanned, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                    Text(stringResource(R.string.calories_log_as_planned))
                }
            }
            TextButton(onClick = onAddFood, modifier = Modifier.padding(horizontal = 8.dp)) {
                Icon(painterResource(R.drawable.ic_add), contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(stringResource(R.string.calories_add_food))
            }
        }
    }
}

@Composable
private fun EntryRow(entry: FoodLogEntry, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(entry.portion.food.name, style = MaterialTheme.typography.bodyLarge)
            Text(
                foodOriginLabel(entry.portion.food),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(portionLabel(entry.portion), style = MaterialTheme.typography.bodyMedium)
    }
}

/** The plan, shown faded until it is logged; free-text foods are listed but cannot count. */
@Composable
private fun PlannedFoods(foods: List<Food>) {
    Column(Modifier.padding(horizontal = 16.dp, vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        foods.forEach { food ->
            Row {
                Text(
                    food.name,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    food.portion?.let { portionLabel(it) } ?: stringResource(R.string.calories_no_nutrition_data),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun CaloriesScreenPreview() {
    val today = LocalDate.of(2026, 10, 3)
    val oats = FoodItem(FoodId(FoodSource.BASIC, "1"), "Avena, fiocchi", Nutrients(370.0, 13.0, 60.0, 7.0))
    val pasta = FoodItem(FoodId(FoodSource.BASIC, "2"), "Pasta di semola", Nutrients(350.0, 12.0, 70.0, 1.5))
    val breakfast = Meal(1, "Colazione", "08:00", listOf(Food(1, oats.name, "", Portion(oats, 50.0))))
    val lunch = Meal(2, "Pranzo", "13:00", listOf(Food(2, pasta.name, "", Portion(pasta, 80.0))))
    TrackerTheme {
        CaloriesScreen(
            state = CaloriesUiState(
                day = CalorieDay(
                    date = today,
                    meals = listOf(
                        MealLog("Colazione", breakfast, listOf(FoodLogEntry(1, today, "Colazione", Portion(oats, 60.0)))),
                        MealLog("Pranzo", lunch),
                    ),
                    hasDietPlan = true,
                ),
                today = today,
                isLoading = false,
            ),
            onAction = {},
            onAddFood = { _, _ -> },
        )
    }
}
