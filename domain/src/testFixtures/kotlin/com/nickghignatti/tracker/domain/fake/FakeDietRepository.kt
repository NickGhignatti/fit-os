package com.nickghignatti.tracker.domain.fake

import com.nickghignatti.tracker.domain.model.Food
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.domain.repository.DietRepository
import java.time.DayOfWeek
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update

/** In-memory [DietRepository] for tests. */
class FakeDietRepository : DietRepository {
    private var lastId = 0L
    private val state = MutableStateFlow<List<Meal>>(emptyList())

    val meals: List<Meal> get() = state.value

    override fun observeMeals(day: DayOfWeek): Flow<List<Meal>> = state.map { all -> all.filter { it.day == day } }

    override suspend fun getMeals(day: DayOfWeek): List<Meal> = state.value.filter { it.day == day }

    override suspend fun addMeal(day: DayOfWeek, name: String, time: String): Long {
        val id = nextId()
        state.update { it + Meal(id, day, name, time, emptyList()) }
        return id
    }

    override suspend fun updateMeal(id: Long, name: String, time: String) =
        updateMeal(id) { it.copy(name = name, time = time) }

    override suspend fun deleteMeal(id: Long) = state.update { all -> all.filterNot { it.id == id } }

    override suspend fun addFood(mealId: Long, name: String, quantity: String) =
        updateMeal(mealId) { it.copy(foods = it.foods + Food(nextId(), name, quantity)) }

    override suspend fun updateFood(id: Long, name: String, quantity: String) =
        updateFoods { if (it.id == id) it.copy(name = name, quantity = quantity) else it }

    override suspend fun deleteFood(id: Long) =
        state.update { all -> all.map { meal -> meal.copy(foods = meal.foods.filterNot { it.id == id }) } }

    override suspend fun replaceMeals(day: DayOfWeek, meals: List<Meal>) = state.update { all ->
        all.filterNot { it.day == day } + meals.map { meal ->
            meal.copy(id = nextId(), day = day, foods = meal.foods.map { it.copy(id = nextId()) })
        }
    }

    private fun updateMeal(id: Long, transform: (Meal) -> Meal) =
        state.update { all -> all.map { if (it.id == id) transform(it) else it } }

    private fun updateFoods(transform: (Food) -> Food) =
        state.update { all -> all.map { meal -> meal.copy(foods = meal.foods.map(transform)) } }

    private fun nextId() = ++lastId
}
