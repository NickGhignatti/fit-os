package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.model.CalorieDay
import com.nickghignatti.tracker.domain.model.FoodItem
import com.nickghignatti.tracker.domain.model.TextSearch
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.domain.model.MealLog
import com.nickghignatti.tracker.domain.repository.BasicFoodRepository
import com.nickghignatti.tracker.domain.repository.CustomFoodRepository
import com.nickghignatti.tracker.domain.repository.DietPlanRepository
import com.nickghignatti.tracker.domain.repository.FoodLogRepository
import com.nickghignatti.tracker.domain.repository.ProductLookup
import com.nickghignatti.tracker.domain.repository.ProductRepository
import com.nickghignatti.tracker.domain.repository.SavedProductRepository
import com.nickghignatti.tracker.domain.repository.TransactionRunner
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine

/**
 * Searches the foods available offline: the user's own foods, packaged products seen before and
 * the basic ones, best match first. Brands count as part of the name, so "yogurt conad" works.
 */
class SearchFoodsUseCase @Inject constructor(
    private val basicFoods: BasicFoodRepository,
    private val customFoods: CustomFoodRepository,
    private val savedProducts: SavedProductRepository,
) {
    suspend operator fun invoke(query: String): List<FoodItem> {
        val candidates = customFoods.search(query) + savedProducts.search(query) + basicFoods.search(query)
        return TextSearch.rank(query, candidates) { it.searchableName }
    }
}

/** A food's name with its brand, as matched by searches. */
val FoodItem.searchableName: String get() = listOfNotNull(name, brand).joinToString(" ")

/**
 * Looks a barcode up online and saves what it finds. Offline, a product scanned or eaten before
 * is still found from the saved copy.
 */
class LookUpBarcodeUseCase @Inject constructor(
    private val products: ProductRepository,
    private val savedProducts: SavedProductRepository,
) {
    suspend operator fun invoke(barcode: String): ProductLookup = when (val lookup = products.findByBarcode(barcode)) {
        is ProductLookup.Found -> lookup.also { savedProducts.save(it.product) }
        ProductLookup.NotFound -> lookup
        ProductLookup.Unavailable -> savedProducts.find(barcode)?.let(ProductLookup::Found) ?: lookup
    }
}

/**
 * A day of eating. Meals follow the active diet's plan for that day, or [defaultMeals] without
 * one; anything logged under another name follows, in the order it was first logged.
 */
class ObserveCalorieDayUseCase @Inject constructor(
    private val foodLog: FoodLogRepository,
    private val dietPlans: DietPlanRepository,
) {
    operator fun invoke(date: LocalDate, defaultMeals: List<String>): Flow<CalorieDay> =
        combine(foodLog.observeEntries(date), dietPlans.observeActivePlan()) { entries, plan ->
            val plannedMeals = plan?.mealsOn(date).orEmpty()
            val byName = entries.groupBy { it.meal }
            val sections = plannedMeals.ifEmpty { null }
                ?.distinctBy { it.name }
                ?.map { MealLog(it.name, planned = it) }
                ?: defaultMeals.map { MealLog(it) }
            val known = sections.map { it.name }.toSet()
            val extra = byName.keys.filterNot { it in known }.map { MealLog(it) }
            CalorieDay(
                date = date,
                meals = (sections + extra).map { it.copy(entries = byName[it.name].orEmpty()) },
                hasDietPlan = plan != null,
            )
        }
}

/** Logs every food of a planned meal that has nutrition data, under the meal's name. */
class LogPlannedMealUseCase @Inject constructor(
    private val foodLog: FoodLogRepository,
    private val transaction: TransactionRunner,
) {
    /** Returns how many foods were logged; free-text foods are skipped. */
    suspend operator fun invoke(date: LocalDate, meal: Meal): Int = transaction.run {
        val portions = meal.foods.mapNotNull { it.portion }
        portions.forEach { foodLog.addEntry(date, meal.name, it) }
        portions.size
    }
}
