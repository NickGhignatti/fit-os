package com.nickghignatti.tracker.data.repository

import androidx.room.withTransaction
import com.nickghignatti.tracker.data.local.AppDatabase
import com.nickghignatti.tracker.data.local.FoodEntity
import com.nickghignatti.tracker.data.local.MealEntity
import com.nickghignatti.tracker.data.mapper.toDomain
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.domain.repository.DietRepository
import java.time.DayOfWeek
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

internal class RoomDietRepository @Inject constructor(
    private val db: AppDatabase,
) : DietRepository {
    private val dao = db.dietDao()

    override fun observeMeals(day: DayOfWeek): Flow<List<Meal>> =
        dao.observeMeals(day).map { rows -> rows.map { it.toDomain() } }

    override suspend fun getMeals(day: DayOfWeek): List<Meal> = dao.getMeals(day).map { it.toDomain() }

    override suspend fun addMeal(day: DayOfWeek, name: String, time: String): Long = db.withTransaction {
        dao.insertMeal(MealEntity(dayOfWeek = day, position = dao.nextMealPosition(day), name = name, time = time))
    }

    override suspend fun updateMeal(id: Long, name: String, time: String) = dao.updateMeal(id, name, time)

    override suspend fun deleteMeal(id: Long) = dao.deleteMeal(id)

    override suspend fun addFood(mealId: Long, name: String, quantity: String) = db.withTransaction {
        dao.insertFoods(
            listOf(FoodEntity(mealId = mealId, position = dao.nextFoodPosition(mealId), name = name, quantity = quantity)),
        )
    }

    override suspend fun updateFood(id: Long, name: String, quantity: String) = dao.updateFood(id, name, quantity)

    override suspend fun deleteFood(id: Long) = dao.deleteFood(id)

    override suspend fun replaceMeals(day: DayOfWeek, meals: List<Meal>) = db.withTransaction {
        dao.deleteMealsOn(day)
        meals.forEachIndexed { position, meal ->
            val mealId = dao.insertMeal(MealEntity(dayOfWeek = day, position = position, name = meal.name, time = meal.time))
            dao.insertFoods(
                meal.foods.mapIndexed { index, food ->
                    FoodEntity(mealId = mealId, position = index, name = food.name, quantity = food.quantity)
                },
            )
        }
    }
}
