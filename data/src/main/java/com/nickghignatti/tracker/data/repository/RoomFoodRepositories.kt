package com.nickghignatti.tracker.data.repository

import com.nickghignatti.tracker.data.local.AppDatabase
import com.nickghignatti.tracker.data.local.CustomFoodEntity
import com.nickghignatti.tracker.data.local.FavoriteFoodEntity
import com.nickghignatti.tracker.data.local.FoodLogEntity
import com.nickghignatti.tracker.data.local.SavedProductEntity
import com.nickghignatti.tracker.data.mapper.toColumns
import com.nickghignatti.tracker.data.mapper.toDomain
import com.nickghignatti.tracker.domain.model.FoodId
import com.nickghignatti.tracker.domain.model.FoodItem
import com.nickghignatti.tracker.domain.model.FoodLogEntry
import com.nickghignatti.tracker.domain.model.TextSearch
import com.nickghignatti.tracker.domain.model.FoodSource
import com.nickghignatti.tracker.domain.model.Nutrients
import com.nickghignatti.tracker.domain.model.Portion
import com.nickghignatti.tracker.domain.repository.CustomFoodRepository
import com.nickghignatti.tracker.domain.repository.FavoriteFoodRepository
import com.nickghignatti.tracker.domain.repository.FoodLogRepository
import com.nickghignatti.tracker.domain.repository.SavedProductRepository
import com.nickghignatti.tracker.domain.usecase.searchableName
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

internal class RoomFoodLogRepository @Inject constructor(db: AppDatabase) : FoodLogRepository {
    private val dao = db.foodLogDao()

    override fun observeEntries(date: LocalDate): Flow<List<FoodLogEntry>> =
        dao.observeEntries(date).map { rows -> rows.map { it.toDomain() } }

    override suspend fun addEntry(date: LocalDate, meal: String, portion: Portion): Long =
        dao.insert(FoodLogEntity(date = date, meal = meal, food = portion.food.toColumns(), grams = portion.grams))

    override suspend fun updateGrams(id: Long, grams: Double) = dao.updateGrams(id, grams)

    override suspend fun deleteEntry(id: Long) = dao.delete(id)

    override fun observeRecentFoods(limit: Int): Flow<List<FoodItem>> =
        dao.observeRecentFoods(limit).map { rows -> rows.map { it.food.toDomain() } }
}

/** Few enough foods that ranking them in memory with the shared search rules is simplest. */
internal class RoomCustomFoodRepository @Inject constructor(db: AppDatabase) : CustomFoodRepository {
    private val dao = db.customFoodDao()

    override suspend fun search(query: String): List<FoodItem> =
        TextSearch.rank(query, dao.getAll().map { it.toDomain() }) { it.name }

    override suspend fun create(name: String, per100g: Nutrients, brand: String?, servingGrams: Double?): FoodItem {
        val entity = CustomFoodEntity(
            name = name,
            brand = brand,
            kcal = per100g.kcal,
            protein = per100g.protein,
            carbs = per100g.carbs,
            fat = per100g.fat,
            servingGrams = servingGrams,
        )
        return entity.copy(id = dao.insert(entity)).toDomain()
    }
}

internal class RoomFavoriteFoodRepository @Inject constructor(db: AppDatabase) : FavoriteFoodRepository {
    private val dao = db.favoriteFoodDao()

    override fun observeFavorites(): Flow<List<FoodItem>> = dao.observeAll().map { rows -> rows.map { it.food.toDomain() } }

    override suspend fun setFavorite(food: FoodItem, favorite: Boolean) =
        if (favorite) dao.insert(FavoriteFoodEntity(food.toColumns())) else dao.delete(food.id)
}

/** A few hundred products at most, so ranking them in memory with the shared search rules is simplest. */
internal class RoomSavedProductRepository @Inject constructor(db: AppDatabase) : SavedProductRepository {
    private val dao = db.savedProductDao()

    override suspend fun save(product: FoodItem) = dao.upsert(SavedProductEntity(product.toColumns()))

    override suspend fun find(barcode: String): FoodItem? = dao.find(FoodId(FoodSource.PRODUCT, barcode))?.food?.toDomain()

    override suspend fun search(query: String): List<FoodItem> =
        TextSearch.rank(query, dao.getAll().map { it.food.toDomain() }) { it.searchableName }
}
