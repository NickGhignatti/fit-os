package com.nickghignatti.tracker.domain.fake

import com.nickghignatti.tracker.domain.model.DietPlan
import com.nickghignatti.tracker.domain.model.Food
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Portion
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.repository.DietPlanRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update

/** In-memory [DietPlanRepository] for tests. */
class FakeDietPlanRepository : DietPlanRepository {
    private var lastId = 0L
    private val state = MutableStateFlow<List<DietPlan>>(emptyList())

    val plans: List<DietPlan> get() = state.value

    fun plan(id: Long): DietPlan = state.value.single { it.id == id }

    override fun observePlans(): Flow<List<DietPlan>> = state.map { all -> all.sortedBy { it.name.lowercase() } }

    override fun observePlan(id: Long): Flow<DietPlan?> = state.map { all -> all.find { it.id == id } }

    override fun observeActivePlan(): Flow<DietPlan?> = state.map { all -> all.find { it.isActive } }

    override suspend fun getActivePlan(): DietPlan? = state.value.find { it.isActive }

    override suspend fun createPlan(name: String, recurrence: Recurrence): Long {
        val id = nextId()
        state.update { it + DietPlan(id, name, recurrence) }
        return id
    }

    override suspend fun renamePlan(id: Long, name: String) = updatePlan(id) { it.copy(name = name) }

    override suspend fun deletePlan(id: Long) = state.update { all -> all.filterNot { it.id == id } }

    override suspend fun setActivePlan(id: Long?) = state.update { all -> all.map { it.copy(isActive = it.id == id) } }

    override suspend fun getMeals(planId: Long, day: PlanDay): List<Meal> = plan(planId).mealsOn(day)

    override suspend fun addMeal(planId: Long, day: PlanDay, name: String, time: String): Long {
        val id = nextId()
        updatePlan(planId) { plan -> plan.copy(meals = plan.meals + (day to plan.mealsOn(day) + Meal(id, name, time, emptyList()))) }
        return id
    }

    override suspend fun updateMeal(id: Long, name: String, time: String) =
        updateMeals { if (it.id == id) it.copy(name = name, time = time) else it }

    override suspend fun deleteMeal(id: Long) = state.update { all ->
        all.map { plan -> plan.copy(meals = plan.meals.mapValues { (_, list) -> list.filterNot { it.id == id } }) }
    }

    override suspend fun addFood(mealId: Long, name: String, quantity: String, portion: Portion?) =
        updateMeals { if (it.id == mealId) it.copy(foods = it.foods + Food(nextId(), name, quantity, portion)) else it }

    override suspend fun updateFood(id: Long, name: String, quantity: String, portion: Portion?) = updateMeals { meal ->
        meal.copy(foods = meal.foods.map { if (it.id == id) it.copy(name = name, quantity = quantity, portion = portion) else it })
    }

    override suspend fun deleteFood(id: Long) = updateMeals { meal -> meal.copy(foods = meal.foods.filterNot { it.id == id }) }

    override suspend fun replaceMeals(planId: Long, day: PlanDay, meals: List<Meal>) = updatePlan(planId) { plan ->
        val copies = meals.map { meal -> meal.copy(id = nextId(), foods = meal.foods.map { it.copy(id = nextId()) }) }
        plan.copy(meals = plan.meals + (day to copies))
    }

    private fun updatePlan(id: Long, transform: (DietPlan) -> DietPlan) =
        state.update { all -> all.map { if (it.id == id) transform(it) else it } }

    private fun updateMeals(transform: (Meal) -> Meal) = state.update { all ->
        all.map { plan -> plan.copy(meals = plan.meals.mapValues { (_, list) -> list.map(transform) }) }
    }

    private fun nextId() = ++lastId
}
