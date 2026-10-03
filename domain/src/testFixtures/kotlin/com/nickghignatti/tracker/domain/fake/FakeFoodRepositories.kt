package com.nickghignatti.tracker.domain.fake

import com.nickghignatti.tracker.domain.model.FoodId
import com.nickghignatti.tracker.domain.model.FoodItem
import com.nickghignatti.tracker.domain.model.FoodLogEntry
import com.nickghignatti.tracker.domain.model.FoodSearch
import com.nickghignatti.tracker.domain.model.FoodSource
import com.nickghignatti.tracker.domain.model.Nutrients
import com.nickghignatti.tracker.domain.model.Portion
import com.nickghignatti.tracker.domain.repository.BasicFoodRepository
import com.nickghignatti.tracker.domain.repository.CustomFoodRepository
import com.nickghignatti.tracker.domain.repository.FavoriteFoodRepository
import com.nickghignatti.tracker.domain.repository.FoodLogRepository
import com.nickghignatti.tracker.domain.repository.ProductLookup
import com.nickghignatti.tracker.domain.repository.ProductRepository
import com.nickghignatti.tracker.domain.repository.ProductSearch
import com.nickghignatti.tracker.domain.repository.SavedProductRepository
import com.nickghignatti.tracker.domain.usecase.searchableName
import java.time.LocalDate
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update

/** A basic food for tests: [kcal] per 100 g, with protein, carbs and fat derived from it. */
fun basicFood(code: String, name: String, kcal: Double = 100.0, servingGrams: Double? = null) = FoodItem(
    id = FoodId(FoodSource.BASIC, code),
    name = name,
    per100g = Nutrients(kcal, protein = kcal / 10, carbs = kcal / 5, fat = kcal / 20),
    servingGrams = servingGrams,
)

/** In-memory [BasicFoodRepository] over a fixed list. */
class FakeBasicFoodRepository(private val foods: List<FoodItem> = emptyList()) : BasicFoodRepository {
    override suspend fun search(query: String): List<FoodItem> = FoodSearch.rank(query, foods) { it.name }
}

/** In-memory [CustomFoodRepository] for tests. */
class FakeCustomFoodRepository : CustomFoodRepository {
    private var lastId = 0L
    val foods = mutableListOf<FoodItem>()

    override suspend fun search(query: String): List<FoodItem> = FoodSearch.rank(query, foods) { it.name }

    override suspend fun create(name: String, per100g: Nutrients, brand: String?, servingGrams: Double?): FoodItem =
        FoodItem(FoodId(FoodSource.CUSTOM, (++lastId).toString()), name, per100g, brand, servingGrams).also(foods::add)
}

/** In-memory [FavoriteFoodRepository] for tests. */
class FakeFavoriteFoodRepository : FavoriteFoodRepository {
    private val state = MutableStateFlow<List<FoodItem>>(emptyList())

    override fun observeFavorites(): Flow<List<FoodItem>> = state

    override suspend fun setFavorite(food: FoodItem, favorite: Boolean) = state.update { all ->
        val others = all.filterNot { it.id == food.id }
        if (favorite) listOf(food) + others else others
    }
}

/** [ProductRepository] with canned answers; [available] false simulates having no network. */
class FakeProductRepository(
    private val products: List<Pair<String, FoodItem>> = emptyList(),
    var available: Boolean = true,
) : ProductRepository {
    val searches = mutableListOf<String>()

    override suspend fun findByBarcode(barcode: String): ProductLookup = when {
        !available -> ProductLookup.Unavailable
        else -> products.find { it.first == barcode }?.let { ProductLookup.Found(it.second) } ?: ProductLookup.NotFound
    }

    override suspend fun search(query: String): ProductSearch {
        searches += query
        // Like Open Food Facts, matches brands as well as names.
        return if (available) ProductSearch.Results(FoodSearch.rank(query, products.map { it.second }) { it.searchableName }) else ProductSearch.Unavailable
    }
}

/** In-memory [FoodLogRepository] for tests. */
class FakeFoodLogRepository : FoodLogRepository {
    private var lastId = 0L
    private val state = MutableStateFlow<List<FoodLogEntry>>(emptyList())

    val entries: List<FoodLogEntry> get() = state.value

    override fun observeEntries(date: LocalDate): Flow<List<FoodLogEntry>> = state.map { all -> all.filter { it.date == date } }

    override suspend fun addEntry(date: LocalDate, meal: String, portion: Portion): Long {
        val id = ++lastId
        state.update { it + FoodLogEntry(id, date, meal, portion) }
        return id
    }

    override suspend fun updateGrams(id: Long, grams: Double) = state.update { all ->
        all.map { if (it.id == id) it.copy(portion = it.portion.copy(grams = grams)) else it }
    }

    override suspend fun deleteEntry(id: Long) = state.update { all -> all.filterNot { it.id == id } }

    override fun observeRecentFoods(limit: Int): Flow<List<FoodItem>> =
        state.map { all -> all.asReversed().map { it.portion.food }.distinctBy { it.id }.take(limit) }
}

/** In-memory [SavedProductRepository] for tests. */
class FakeSavedProductRepository : SavedProductRepository {
    val products = mutableListOf<FoodItem>()

    override suspend fun save(product: FoodItem) {
        products.removeAll { it.id == product.id }
        products.add(0, product)
    }

    override suspend fun find(barcode: String): FoodItem? = products.find { it.id.key == barcode }

    override suspend fun search(query: String): List<FoodItem> = FoodSearch.rank(query, products) { it.searchableName }
}
