package com.nickghignatti.tracker.domain.repository

import com.nickghignatti.tracker.domain.model.DietPlan
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Portion

/** Diet plans with their meals and foods. Lists are returned in the user's order. */
interface DietPlanRepository : PlanRepository<DietPlan> {
    suspend fun getMeals(planId: Long, day: PlanDay): List<Meal>

    /** Appends a meal at the end of [day]; returns its id. */
    suspend fun addMeal(planId: Long, day: PlanDay, name: String, time: String): Long

    suspend fun updateMeal(id: Long, name: String, time: String)

    suspend fun deleteMeal(id: Long)

    /** Appends a food at the end of the meal; with a [portion], its nutrition counts. */
    suspend fun addFood(mealId: Long, name: String, quantity: String, portion: Portion? = null)

    suspend fun updateFood(id: Long, name: String, quantity: String, portion: Portion? = null)

    suspend fun deleteFood(id: Long)

    /** Replaces everything planned on [day] with copies of [meals] (their ids are ignored). */
    suspend fun replaceMeals(planId: Long, day: PlanDay, meals: List<Meal>)
}
