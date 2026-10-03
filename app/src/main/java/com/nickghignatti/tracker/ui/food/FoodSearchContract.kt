package com.nickghignatti.tracker.ui.food

import com.nickghignatti.tracker.domain.model.FoodItem
import com.nickghignatti.tracker.domain.model.Nutrients
import java.time.LocalDate

/** Where a picked food goes. */
sealed interface FoodTarget {
    val mealName: String

    /** Eaten: into the food log. */
    data class Log(val date: LocalDate, override val mealName: String) : FoodTarget

    /** Planned: into a meal of a diet plan. */
    data class DietMeal(val mealId: Long, override val mealName: String) : FoodTarget
}

data class FoodSearchUiState(
    val target: FoodTarget,
    val query: String = "",
    /** The user's own foods and the basic ones, matching [query]. */
    val localResults: List<FoodItem> = emptyList(),
    val products: ProductResults = ProductResults.Idle,
    val favorites: List<FoodItem> = emptyList(),
    val recent: List<FoodItem> = emptyList(),
    /** The food whose amount is being chosen. */
    val picked: FoodItem? = null,
    val isLookingUpBarcode: Boolean = false,
) {
    val favoriteIds get() = favorites.map { it.id }.toSet()

    /** Online results not already listed among the offline ones (products saved before). */
    val onlineProducts: List<FoodItem>
        get() {
            val listed = localResults.map { it.id }.toSet()
            return (products as? ProductResults.Found)?.products.orEmpty().filterNot { it.id in listed }
        }

    /** Recent foods that are not favourites already, since favourites are listed first. */
    val recentNotFavorite get() = recent.filterNot { it.id in favoriteIds }
}

/** Packaged products are searched online, a moment after typing stops. */
sealed interface ProductResults {
    data object Idle : ProductResults
    data object Loading : ProductResults
    data class Found(val products: List<FoodItem>) : ProductResults
    data object Unavailable : ProductResults
}

sealed interface FoodSearchAction {
    data class QueryChanged(val query: String) : FoodSearchAction
    data class Pick(val food: FoodItem) : FoodSearchAction
    data object DismissPick : FoodSearchAction
    data class ConfirmAmount(val grams: Double) : FoodSearchAction
    data class ToggleFavorite(val food: FoodItem) : FoodSearchAction
    data class BarcodeScanned(val barcode: String) : FoodSearchAction
    data class CreateCustomFood(val name: String, val per100g: Nutrients, val servingGrams: Double?) : FoodSearchAction

    /** Diet plans only: a food without nutrition data, as before. */
    data class AddAsText(val name: String, val quantity: String) : FoodSearchAction
}

sealed interface FoodSearchEvent {
    /** The food was added; the screen can close. */
    data object Added : FoodSearchEvent
    data class ProductNotFound(val barcode: String) : FoodSearchEvent
    data object ProductsUnavailable : FoodSearchEvent
}
