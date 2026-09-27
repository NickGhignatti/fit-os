package com.nickghignatti.tracker.domain.repository

import com.nickghignatti.tracker.domain.model.Meal
import java.time.DayOfWeek
import kotlinx.coroutines.flow.Flow

/** The weekly meal plan. Lists are returned in the user's order. */
interface DietRepository {
    fun observeMeals(day: DayOfWeek): Flow<List<Meal>>

    suspend fun getMeals(day: DayOfWeek): List<Meal>

    /** Appends a meal at the end of [day]; returns its id. */
    suspend fun addMeal(day: DayOfWeek, name: String, time: String): Long

    suspend fun updateMeal(id: Long, name: String, time: String)

    suspend fun deleteMeal(id: Long)

    /** Appends a food at the end of the meal. */
    suspend fun addFood(mealId: Long, name: String, quantity: String)

    suspend fun updateFood(id: Long, name: String, quantity: String)

    suspend fun deleteFood(id: Long)

    /** Replaces everything planned on [day] with copies of [meals] (their ids and days are ignored). */
    suspend fun replaceMeals(day: DayOfWeek, meals: List<Meal>)
}
