package com.nickghignatti.tracker.domain.repository

import com.nickghignatti.tracker.domain.model.FoodItem
import com.nickghignatti.tracker.domain.model.Nutrients
import kotlinx.coroutines.flow.Flow

/** Basic foods (CREA tables), available offline. */
interface BasicFoodRepository {
    /** Foods matching [query], best first; empty for a blank query. */
    suspend fun search(query: String): List<FoodItem>
}

/** Foods the user created. */
interface CustomFoodRepository {
    suspend fun search(query: String): List<FoodItem>

    /** Saves a new food and returns it with its id. */
    suspend fun create(name: String, per100g: Nutrients, brand: String?, servingGrams: Double?): FoodItem
}

/** Foods marked as favourite, newest first. */
interface FavoriteFoodRepository {
    fun observeFavorites(): Flow<List<FoodItem>>

    suspend fun setFavorite(food: FoodItem, favorite: Boolean)
}

/** Packaged products from Open Food Facts; needs a network connection. */
interface ProductRepository {
    suspend fun findByBarcode(barcode: String): ProductLookup

    suspend fun search(query: String): ProductSearch
}

sealed interface ProductLookup {
    data class Found(val product: FoodItem) : ProductLookup

    /** Unknown barcode, or a product without nutrition data. */
    data object NotFound : ProductLookup

    /** No network, or the service did not answer. */
    data object Unavailable : ProductLookup
}

sealed interface ProductSearch {
    data class Results(val products: List<FoodItem>) : ProductSearch

    data object Unavailable : ProductSearch
}

/** Packaged products the user scanned or ate, kept so they can be found again offline. */
interface SavedProductRepository {
    /** Saves the product, or refreshes the saved copy with newer data. */
    suspend fun save(product: FoodItem)

    suspend fun find(barcode: String): FoodItem?

    suspend fun search(query: String): List<FoodItem>
}
