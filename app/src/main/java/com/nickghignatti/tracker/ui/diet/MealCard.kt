package com.nickghignatti.tracker.ui.diet

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.Food
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.ui.components.Hairline
import com.nickghignatti.tracker.ui.components.MenuItem
import com.nickghignatti.tracker.ui.components.OverflowMenu
import com.nickghignatti.tracker.ui.components.TrackerCard
import com.nickghignatti.tracker.ui.food.kcalLabel
import com.nickghignatti.tracker.ui.food.macrosLabel
import com.nickghignatti.tracker.ui.format.formatWeight
import com.nickghignatti.tracker.ui.theme.Tracker

/** Editing callbacks for [MealCard]; omit them for a read-only card. */
class MealCardActions(
    val onEditMeal: (Meal) -> Unit,
    val onDeleteMeal: (Meal) -> Unit,
    val onAddFood: (Meal) -> Unit,
    val onEditFood: (Food) -> Unit,
)

@Composable
fun MealCard(meal: Meal, modifier: Modifier = Modifier, actions: MealCardActions? = null) {
    TrackerCard(modifier.fillMaxWidth(), contentPadding = PaddingValues(0.dp)) {
        Row(
            modifier = Modifier
                .padding(start = Tracker.dimens.lg, end = Tracker.dimens.xs)
                .heightIn(min = Tracker.dimens.buttonHeight + Tracker.dimens.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(meal.name, style = Tracker.type.bodyLg, color = Tracker.colors.ink)
                if (meal.time.isNotBlank()) {
                    Text(
                        stringResource(R.string.meal_scheduled, meal.time),
                        style = Tracker.type.tabularCaption,
                        color = Tracker.colors.inkSecondary,
                    )
                }
            }
            meal.nutrients?.let {
                Text(
                    kcalLabel(it.kcal),
                    style = Tracker.type.labelMd,
                    color = Tracker.colors.ink,
                    modifier = Modifier.padding(end = if (actions == null) Tracker.dimens.lg else Tracker.dimens.md),
                )
            }
            if (actions != null) {
                OverflowMenu(
                    listOf(
                        MenuItem(stringResource(R.string.meal_edit)) { actions.onEditMeal(meal) },
                        MenuItem(stringResource(R.string.meal_delete)) { actions.onDeleteMeal(meal) },
                    ),
                )
            }
        }
        if (meal.foods.isEmpty() && actions == null) {
            Hairline()
            Text(
                stringResource(R.string.meal_no_foods),
                style = Tracker.type.bodyMd,
                color = Tracker.colors.inkSecondary,
                modifier = Modifier.padding(Tracker.dimens.lg),
            )
        }
        meal.foods.forEach { food ->
            Hairline()
            FoodRow(food, onClick = actions?.let { { it.onEditFood(food) } })
        }
        Hairline()
        MealFooter(meal.foods.size, onAddFood = actions?.let { { it.onAddFood(meal) } })
    }
}

/** Muted strip closing the card: the add action on the left, how many foods are planned on the right. */
@Composable
private fun MealFooter(count: Int, onAddFood: (() -> Unit)?) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Tracker.colors.surfaceMuted)
            .heightIn(min = Tracker.dimens.rowMinHeight)
            .padding(horizontal = Tracker.dimens.lg),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onAddFood != null) {
            Row(
                Modifier.weight(1f).clickable(role = Role.Button, onClick = onAddFood).heightIn(min = Tracker.dimens.rowMinHeight),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.sm),
            ) {
                Icon(painterResource(R.drawable.ic_add), contentDescription = null, modifier = Modifier.size(FooterIconSize))
                Text(stringResource(R.string.meal_add_food), style = Tracker.type.labelMd, color = Tracker.colors.ink)
            }
        } else {
            Spacer(Modifier.weight(1f))
        }
        Text(
            pluralStringResource(R.plurals.meal_items_scheduled, count, count),
            style = Tracker.type.tabularCaption,
            color = Tracker.colors.inkSecondary,
        )
    }
}

private val FooterIconSize = 16.dp

@Composable
private fun FoodRow(food: Food, onClick: (() -> Unit)?) {
    val portion = food.portion
    Row(
        modifier = Modifier
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .fillMaxWidth()
            .heightIn(min = Tracker.dimens.rowMinHeight)
            .padding(horizontal = Tracker.dimens.lg, vertical = Tracker.dimens.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                if (portion != null) "${food.name} (${stringResource(R.string.grams_label, formatWeight(portion.grams))})" else food.name,
                style = Tracker.type.bodyMd,
                color = Tracker.colors.ink,
            )
            val detail = if (portion != null) macrosLabel(portion.nutrients) else food.quantity
            if (detail.isNotBlank()) {
                Text(detail, style = Tracker.type.tabularCaption, color = Tracker.colors.inkSecondary)
            }
        }
        if (portion != null) {
            Text(kcalLabel(portion.nutrients.kcal), style = Tracker.type.labelMd, color = Tracker.colors.ink)
        }
    }
}
