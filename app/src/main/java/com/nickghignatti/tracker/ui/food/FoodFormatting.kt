package com.nickghignatti.tracker.ui.food

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.FoodItem
import com.nickghignatti.tracker.domain.model.FoodSource
import com.nickghignatti.tracker.domain.model.Nutrients
import com.nickghignatti.tracker.domain.model.Portion
import com.nickghignatti.tracker.ui.format.formatWeight
import kotlin.math.roundToInt

/** "290 kcal". */
@Composable
fun kcalLabel(kcal: Double): String = stringResource(R.string.kcal_value, kcal.roundToInt())

/** "P 12 g · C 40 g · F 5 g". */
@Composable
fun macrosLabel(nutrients: Nutrients): String = stringResource(
    R.string.macros_value,
    nutrients.protein.roundToInt(),
    nutrients.carbs.roundToInt(),
    nutrients.fat.roundToInt(),
)

/** "80 g · 290 kcal". */
@Composable
fun portionLabel(portion: Portion): String =
    stringResource(R.string.portion_value, formatWeight(portion.grams), kcalLabel(portion.nutrients.kcal))

/** The brand for products, otherwise where the data comes from. */
@Composable
fun foodOriginLabel(food: FoodItem): String = food.brand ?: stringResource(
    when (food.id.source) {
        FoodSource.BASIC -> R.string.food_source_basic
        FoodSource.PRODUCT -> R.string.food_source_product
        FoodSource.CUSTOM -> R.string.food_source_custom
    },
)
