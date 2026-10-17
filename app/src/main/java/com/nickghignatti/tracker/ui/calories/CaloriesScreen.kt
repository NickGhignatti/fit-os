package com.nickghignatti.tracker.ui.calories

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
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
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
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
import com.nickghignatti.tracker.ui.components.Hairline
import com.nickghignatti.tracker.ui.components.MacroTile
import com.nickghignatti.tracker.ui.components.ProgressTrack
import com.nickghignatti.tracker.ui.components.SectionLabel
import com.nickghignatti.tracker.ui.components.TrackerButton
import com.nickghignatti.tracker.ui.components.TrackerCard
import com.nickghignatti.tracker.ui.components.TrackerTopBar
import com.nickghignatti.tracker.ui.food.AmountDialog
import com.nickghignatti.tracker.ui.food.foodOriginLabel
import com.nickghignatti.tracker.ui.food.kcalLabel
import com.nickghignatti.tracker.ui.food.portionLabel
import com.nickghignatti.tracker.ui.format.formatWeight
import com.nickghignatti.tracker.ui.format.formatted
import com.nickghignatti.tracker.ui.theme.ButtonKind
import com.nickghignatti.tracker.ui.theme.Macro
import com.nickghignatti.tracker.ui.theme.Tracker
import com.nickghignatti.tracker.ui.theme.TrackerTheme
import java.time.LocalDate
import java.time.format.FormatStyle
import kotlin.math.roundToInt

@Composable
fun CaloriesScreen(
    onAddFood: (date: LocalDate, meal: String, scan: Boolean) -> Unit,
    viewModel: CaloriesViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    CaloriesScreen(state, viewModel::onAction, onAddFood)
}

@Composable
internal fun CaloriesScreen(
    state: CaloriesUiState,
    onAction: (CaloriesAction) -> Unit,
    onAddFood: (date: LocalDate, meal: String, scan: Boolean) -> Unit,
) {
    var editing by remember { mutableStateOf<FoodLogEntry?>(null) }

    Scaffold(topBar = { TrackerTopBar(stringResource(R.string.calories_title)) }) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding),
            contentPadding = PaddingValues(
                start = Tracker.dimens.pageMargin,
                end = Tracker.dimens.pageMargin,
                bottom = Tracker.dimens.xl,
            ),
            verticalArrangement = Arrangement.spacedBy(Tracker.dimens.md),
        ) {
            item { DayNavigator(state, onAction) }
            if (state.isLoading) return@LazyColumn
            item { SummaryCard(state.day, state.targets?.nutrients) }
            item { MacroRow(state.day, state.targets?.nutrients) }
            quickLogTarget(state.day)?.let { meal ->
                item { QuickActions(onScan = { onAddFood(state.date, meal, true) }, onSearch = { onAddFood(state.date, meal, false) }) }
            }
            item {
                SectionLabel(
                    stringResource(R.string.calories_logged_meals),
                    Modifier.padding(top = Tracker.dimens.sm),
                    trailing = stringResource(
                        R.string.calories_meals_logged,
                        state.day.meals.count { it.entries.isNotEmpty() },
                        state.day.meals.size,
                    ),
                )
            }
            items(state.day.meals, key = { it.name }) { meal ->
                MealLogCard(
                    meal = meal,
                    onAddFood = { onAddFood(state.date, meal.name, false) },
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
            style = Tracker.type.bodyLg,
            color = Tracker.colors.ink,
            textAlign = TextAlign.Center,
            modifier = Modifier.weight(1f).clickable { onAction(CaloriesAction.GoToToday) },
        )
        IconButton(onClick = { onAction(CaloriesAction.NextDay) }) {
            Icon(painterResource(R.drawable.ic_chevron_right), stringResource(R.string.calories_next_day))
        }
    }
}

/** Where the quick actions log to: the first meal with nothing logged yet, else the first meal. */
private fun quickLogTarget(day: CalorieDay): String? =
    (day.meals.firstOrNull { it.entries.isEmpty() } ?: day.meals.firstOrNull())?.name

@Composable
private fun SummaryCard(day: CalorieDay, goal: Nutrients?) {
    val eaten = day.eaten
    // The profile's goal is the target; without one, the diet's plan is.
    val target = goal ?: day.planned
    TrackerCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SectionLabel(stringResource(R.string.calories_energy_balance), Modifier.weight(1f))
            if (target != null && target.kcal > 0) {
                Text(
                    stringResource(R.string.calories_target, kcalLabel(target.kcal)),
                    style = Tracker.type.tabularCaption,
                    color = Tracker.colors.inkSecondary,
                )
            }
        }
        Hairline(Modifier.padding(vertical = Tracker.dimens.md))
        if (target == null || target.kcal <= 0) {
            EnergyFigure(stringResource(R.string.calories_eaten_label), eaten.kcal, Tracker.colors.ink)
            Text(
                stringResource(R.string.calories_no_goal_hint),
                style = Tracker.type.bodyMd,
                color = Tracker.colors.inkSecondary,
                modifier = Modifier.padding(top = Tracker.dimens.sm),
            )
            return@TrackerCard
        }
        val remaining = target.kcal - eaten.kcal
        val over = remaining < 0
        Row(Modifier.height(IntrinsicSize.Min)) {
            EnergyFigure(stringResource(R.string.calories_eaten_label), eaten.kcal, Tracker.colors.ink, Modifier.weight(1f))
            Box(Modifier.fillMaxHeight().width(Tracker.dimens.borderWidth).background(Tracker.colors.divider))
            EnergyFigure(
                label = stringResource(if (over) R.string.calories_over_label else R.string.calories_remaining),
                kcal = kotlin.math.abs(remaining),
                color = if (over) Tracker.colors.danger else Tracker.colors.accent,
                modifier = Modifier.weight(1f).padding(start = Tracker.dimens.lg),
            )
        }
        val fraction = (eaten.kcal / target.kcal).toFloat()
        Text(
            stringResource(R.string.calories_consumed, "%.1f".format(fraction * 100)),
            style = Tracker.type.tabularCaption,
            color = Tracker.colors.inkSecondary,
            modifier = Modifier.padding(top = Tracker.dimens.md),
        )
        ProgressTrack(
            fraction = fraction,
            color = if (over) Tracker.colors.danger else Tracker.colors.accent,
            modifier = Modifier.padding(top = Tracker.dimens.sm),
        )
        if (goal != null && day.planned != null) {
            Text(
                stringResource(R.string.calories_diet_plans, kcalLabel(day.planned!!.kcal)),
                style = Tracker.type.bodySm,
                color = Tracker.colors.inkSecondary,
                modifier = Modifier.padding(top = Tracker.dimens.sm),
            )
        }
    }
}

@Composable
private fun EnergyFigure(label: String, kcal: Double, color: Color, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(label, style = Tracker.type.bodySm, color = Tracker.colors.inkSecondary)
        Row(verticalAlignment = Alignment.Bottom) {
            Text("%,d".format(kcal.roundToInt()), style = Tracker.type.metricXl, color = color)
            Text(
                " " + stringResource(R.string.unit_kcal),
                style = Tracker.type.bodyMd,
                color = Tracker.colors.inkSecondary,
                modifier = Modifier.padding(bottom = Tracker.dimens.xs),
            )
        }
    }
}

@Composable
private fun MacroRow(day: CalorieDay, goal: Nutrients?) {
    val eaten = day.eaten
    val planned = goal ?: day.planned
    Row(horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.sm)) {
        MacroCard(Macro.Protein, stringResource(R.string.label_protein), eaten.protein, planned?.protein, Modifier.weight(1f))
        MacroCard(Macro.Carbs, stringResource(R.string.label_carbs), eaten.carbs, planned?.carbs, Modifier.weight(1f))
        MacroCard(Macro.Fat, stringResource(R.string.label_fat), eaten.fat, planned?.fat, Modifier.weight(1f))
    }
}

@Composable
private fun QuickActions(onScan: () -> Unit, onSearch: () -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.sm)) {
        TrackerButton(stringResource(R.string.calories_scan), onScan, Modifier.weight(1f), ButtonKind.Secondary, R.drawable.ic_barcode)
        TrackerButton(stringResource(R.string.calories_search), onSearch, Modifier.weight(1f), ButtonKind.Primary, R.drawable.ic_search)
    }
}

@Composable
private fun MacroCard(macro: Macro, label: String, eaten: Double, planned: Double?, modifier: Modifier = Modifier) {
    val fraction = if (planned != null && planned > 0) (eaten / planned).toFloat() else 0f
    MacroTile(
        macro = macro,
        name = label,
        value = stringResource(R.string.grams_value, eaten.roundToInt()),
        target = planned?.let { stringResource(R.string.grams_value, it.roundToInt()) } ?: "–",
        fraction = fraction,
        percentText = planned?.takeIf { it > 0 }?.let { "${(fraction * 100).roundToInt()}%" },
        modifier = modifier,
    )
}

@Composable
private fun MealLogCard(
    meal: MealLog,
    onAddFood: () -> Unit,
    onLogAsPlanned: () -> Unit,
    onEditEntry: (FoodLogEntry) -> Unit,
) {
    val logged = meal.entries.isNotEmpty()
    TrackerCard(
        modifier = Modifier.fillMaxWidth().then(if (logged) Modifier else Modifier.dashedBorder(Tracker.colors.border)),
        borderColor = if (logged) Tracker.colors.border else Color.Transparent,
        containerColor = if (logged) Tracker.colors.surface else Tracker.colors.canvas,
        contentPadding = PaddingValues(0.dp),
    ) {
        Row(
            Modifier.padding(horizontal = Tracker.dimens.lg, vertical = Tracker.dimens.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(meal.name, style = Tracker.type.bodyLg, color = Tracker.colors.ink)
                Text(
                    if (logged) {
                        pluralStringResource(R.plurals.calories_items_logged, meal.entries.size, meal.entries.size)
                    } else {
                        listOfNotNull(
                            stringResource(R.string.calories_pending),
                            meal.planned?.nutrients?.let { stringResource(R.string.calories_planned_value, kcalLabel(it.kcal)) },
                        ).joinToString(" · ")
                    },
                    style = Tracker.type.tabularCaption,
                    color = Tracker.colors.inkSecondary,
                )
            }
            if (logged) Text(kcalLabel(meal.eaten.kcal), style = Tracker.type.labelMd, color = Tracker.colors.ink)
        }
        meal.entries.forEach { entry ->
            Hairline()
            EntryRow(entry, onClick = { onEditEntry(entry) })
        }
        if (meal.canLogAsPlanned) {
            PlannedFoods(meal.planned!!.foods)
        }
        Row(
            Modifier.padding(horizontal = Tracker.dimens.lg, vertical = Tracker.dimens.md),
            horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.sm),
        ) {
            if (meal.canLogAsPlanned) {
                TrackerButton(
                    text = stringResource(R.string.calories_log_meal, meal.name),
                    onClick = onLogAsPlanned,
                    kind = ButtonKind.Positive,
                    icon = R.drawable.ic_add,
                    compact = true,
                )
            }
            TrackerButton(
                text = stringResource(R.string.calories_add_food),
                onClick = onAddFood,
                kind = ButtonKind.Secondary,
                icon = if (meal.canLogAsPlanned) null else R.drawable.ic_add,
                compact = true,
            )
        }
    }
}

/** Dashed outline in the card shape, for a meal that has not been logged yet. */
@Composable
private fun Modifier.dashedBorder(color: Color): Modifier {
    val shape = Tracker.dimens.card
    val width = Tracker.dimens.borderWidth
    return drawWithContent {
        drawContent()
        drawOutline(
            outline = shape.createOutline(size, LayoutDirection.Ltr, Density(density, fontScale)),
            color = color,
            style = Stroke(width.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(DASH_PX, DASH_PX))),
        )
    }
}

private const val DASH_PX = 12f

@Composable
private fun EntryRow(entry: FoodLogEntry, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = Tracker.dimens.rowMinHeight)
            .clickable(onClick = onClick)
            .padding(horizontal = Tracker.dimens.lg, vertical = Tracker.dimens.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                "${entry.portion.food.name} (${stringResource(R.string.grams_label, formatWeight(entry.portion.grams))})",
                style = Tracker.type.bodyMd,
                color = Tracker.colors.ink,
            )
            Text(foodOriginLabel(entry.portion.food), style = Tracker.type.bodySm, color = Tracker.colors.inkSecondary)
        }
        Text(kcalLabel(entry.portion.nutrients.kcal), style = Tracker.type.tabularCaption, color = Tracker.colors.inkSecondary)
    }
}

/** The plan, shown faded until it is logged; free-text foods are listed but cannot count. */
@Composable
private fun PlannedFoods(foods: List<Food>) {
    Column(
        Modifier.padding(horizontal = Tracker.dimens.lg, vertical = Tracker.dimens.sm),
        verticalArrangement = Arrangement.spacedBy(Tracker.dimens.xs),
    ) {
        foods.forEach { food ->
            Row {
                Text(
                    food.name,
                    style = Tracker.type.bodyMd,
                    color = Tracker.colors.inkSecondary,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    food.portion?.let { portionLabel(it) } ?: stringResource(R.string.calories_no_nutrition_data),
                    style = Tracker.type.tabularCaption,
                    color = Tracker.colors.inkTertiary,
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
            onAddFood = { _, _, _ -> },
        )
    }
}
