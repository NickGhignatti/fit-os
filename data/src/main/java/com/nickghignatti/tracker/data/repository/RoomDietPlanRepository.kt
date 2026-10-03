package com.nickghignatti.tracker.data.repository

import androidx.room.withTransaction
import com.nickghignatti.tracker.data.local.AppDatabase
import com.nickghignatti.tracker.data.local.DietPlanEntity
import com.nickghignatti.tracker.data.local.FoodEntity
import com.nickghignatti.tracker.data.local.MealEntity
import com.nickghignatti.tracker.data.mapper.toColumns
import com.nickghignatti.tracker.data.mapper.toDomain
import com.nickghignatti.tracker.domain.model.DietPlan
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Portion
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.repository.DietPlanRepository
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

internal class RoomDietPlanRepository @Inject constructor(
    private val db: AppDatabase,
) : DietPlanRepository {
    private val dao = db.dietPlanDao()

    override fun observePlans(): Flow<List<DietPlan>> = dao.observePlans().map { rows -> rows.map { it.toDomain() } }

    override fun observePlan(id: Long): Flow<DietPlan?> = dao.observePlan(id).map { it?.toDomain() }

    override fun observeActivePlan(): Flow<DietPlan?> = dao.observeActivePlan().map { it?.toDomain() }

    override suspend fun getActivePlan(): DietPlan? = dao.getActivePlan()?.toDomain()

    override suspend fun createPlan(name: String, recurrence: Recurrence): Long =
        dao.insertPlan(DietPlanEntity(name = name, recurrence = recurrence))

    override suspend fun renamePlan(id: Long, name: String) = dao.renamePlan(id, name)

    override suspend fun deletePlan(id: Long) = dao.deletePlan(id)

    override suspend fun setActivePlan(id: Long?) = dao.setActivePlan(id)

    override suspend fun getMeals(planId: Long, day: PlanDay): List<Meal> = dao.getMeals(planId, day).map { it.toDomain() }

    override suspend fun addMeal(planId: Long, day: PlanDay, name: String, time: String): Long = db.withTransaction {
        dao.insertMeal(
            MealEntity(planId = planId, day = day, position = dao.nextMealPosition(planId, day), name = name, time = time),
        )
    }

    override suspend fun updateMeal(id: Long, name: String, time: String) = dao.updateMeal(id, name, time)

    override suspend fun deleteMeal(id: Long) = dao.deleteMeal(id)

    override suspend fun addFood(mealId: Long, name: String, quantity: String, portion: Portion?) = db.withTransaction {
        dao.insertFoods(
            listOf(
                FoodEntity(mealId = mealId, position = dao.nextFoodPosition(mealId), name = name, quantity = quantity)
                    .withPortion(portion),
            ),
        )
    }

    override suspend fun updateFood(id: Long, name: String, quantity: String, portion: Portion?) = db.withTransaction {
        val food = dao.getFood(id) ?: return@withTransaction
        dao.updateFood(food.copy(name = name, quantity = quantity).withPortion(portion))
    }

    override suspend fun deleteFood(id: Long) = dao.deleteFood(id)

    override suspend fun replaceMeals(planId: Long, day: PlanDay, meals: List<Meal>) = db.withTransaction {
        dao.deleteMeals(planId, day)
        meals.forEachIndexed { position, meal ->
            val mealId = dao.insertMeal(
                MealEntity(planId = planId, day = day, position = position, name = meal.name, time = meal.time),
            )
            dao.insertFoods(
                meal.foods.mapIndexed { index, food ->
                    FoodEntity(mealId = mealId, position = index, name = food.name, quantity = food.quantity)
                        .withPortion(food.portion)
                },
            )
        }
    }

    private fun FoodEntity.withPortion(portion: Portion?) =
        copy(linkedFood = portion?.food?.toColumns(), grams = portion?.grams)
}
