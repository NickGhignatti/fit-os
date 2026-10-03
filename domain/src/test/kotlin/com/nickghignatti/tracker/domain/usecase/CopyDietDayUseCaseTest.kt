package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.fake.FakeDietPlanRepository
import com.nickghignatti.tracker.domain.fake.ImmediateTransactionRunner
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import java.time.DayOfWeek.FRIDAY
import java.time.DayOfWeek.MONDAY
import java.time.DayOfWeek.TUESDAY
import java.time.DayOfWeek.WEDNESDAY
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class CopyDietDayUseCaseTest {

    private val diet = FakeDietPlanRepository()
    private val copyDay = CopyDietDayUseCase(diet, ImmediateTransactionRunner())

    private val monday = PlanDay.Weekday(MONDAY)
    private val tuesday = PlanDay.Weekday(TUESDAY)
    private val wednesday = PlanDay.Weekday(WEDNESDAY)
    private val friday = PlanDay.Weekday(FRIDAY)

    @Test
    fun `copies meals and foods to every target, replacing what was there`() = runTest {
        val plan = diet.createPlan("Cut", Recurrence.WEEKLY)
        val breakfast = diet.addMeal(plan, monday, "Breakfast", "08:00")
        diet.addFood(breakfast, "Oats", "80 g")
        diet.addMeal(plan, monday, "Lunch", "")
        diet.addMeal(plan, tuesday, "Old plan", "")

        copyDay(plan, monday, setOf(tuesday, wednesday))

        for (day in listOf(tuesday, wednesday)) {
            val meals = diet.getMeals(plan, day)
            assertEquals(listOf("Breakfast", "Lunch"), meals.map { it.name })
            assertEquals("08:00", meals[0].time)
            assertEquals(listOf("Oats" to "80 g"), meals[0].foods.map { it.name to it.quantity })
        }
    }

    @Test
    fun `leaves the source, other days and other plans untouched`() = runTest {
        val plan = diet.createPlan("Cut", Recurrence.WEEKLY)
        val other = diet.createPlan("Bulk", Recurrence.WEEKLY)
        diet.addMeal(plan, monday, "Breakfast", "")
        diet.addMeal(plan, friday, "Pizza", "")
        diet.addMeal(other, tuesday, "Steak", "")

        copyDay(plan, monday, setOf(monday, tuesday))

        assertEquals(listOf("Breakfast"), diet.getMeals(plan, monday).map { it.name })
        assertEquals(listOf("Pizza"), diet.getMeals(plan, friday).map { it.name })
        assertEquals(listOf("Steak"), diet.getMeals(other, tuesday).map { it.name })
    }
}
