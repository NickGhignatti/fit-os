package com.nickghignatti.tracker.ui.diet

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.Food
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.ui.components.MenuItem
import com.nickghignatti.tracker.ui.components.OverflowMenu
import com.nickghignatti.tracker.ui.food.kcalLabel
import com.nickghignatti.tracker.ui.food.portionLabel

/** Editing callbacks for [MealCard]; omit them for a read-only card. */
class MealCardActions(
    val onEditMeal: (Meal) -> Unit,
    val onDeleteMeal: (Meal) -> Unit,
    val onAddFood: (Meal) -> Unit,
    val onEditFood: (Food) -> Unit,
)

@Composable
fun MealCard(meal: Meal, modifier: Modifier = Modifier, actions: MealCardActions? = null) {
    val editable = actions != null
    ElevatedCard(modifier.fillMaxWidth()) {
        Column(Modifier.padding(vertical = 12.dp)) {
            Row(
                modifier = Modifier.padding(start = 16.dp, end = 4.dp).heightIn(min = 40.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(meal.name, style = MaterialTheme.typography.titleMedium)
                    if (meal.time.isNotBlank()) {
                        Text(
                            meal.time,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                meal.nutrients?.let {
                    Text(kcalLabel(it.kcal), style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(end = 12.dp))
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
            if (meal.foods.isEmpty() && !editable) {
                Text(
                    stringResource(R.string.meal_no_foods),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }
            meal.foods.forEach { food ->
                FoodRow(food, onClick = actions?.let { { it.onEditFood(food) } })
            }
            if (actions != null) {
                TextButton(onClick = { actions.onAddFood(meal) }, modifier = Modifier.padding(horizontal = 8.dp)) {
                    Icon(painterResource(R.drawable.ic_add), contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.meal_add_food))
                }
            }
        }
    }
}

@Composable
private fun FoodRow(food: Food, onClick: (() -> Unit)?) {
    Row(
        modifier = Modifier
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .fillMaxWidth()
            .heightIn(min = if (onClick != null) 48.dp else 32.dp)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(food.name, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
        val amount = food.portion?.let { portionLabel(it) } ?: food.quantity
        if (amount.isNotBlank()) {
            Text(amount, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
