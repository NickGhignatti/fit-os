package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.fake.FakeDietRepository
import com.nickghignatti.tracker.domain.fake.ImmediateTransactionRunner
import java.time.DayOfWeek.FRIDAY
import java.time.DayOfWeek.MONDAY
import java.time.DayOfWeek.TUESDAY
import java.time.DayOfWeek.WEDNESDAY
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class CopyDietDayUseCaseTest {

    private val diet = FakeDietRepository()
    private val copyDay = CopyDietDayUseCase(diet, ImmediateTransactionRunner())

    @Test
    fun `copies meals and foods to every target, replacing what was there`() = runTest {
        val breakfast = diet.addMeal(MONDAY, "Breakfast", "08:00")
        diet.addFood(breakfast, "Oats", "80 g")
        diet.addMeal(MONDAY, "Lunch", "")
        diet.addMeal(TUESDAY, "Old plan", "")

        copyDay(MONDAY, setOf(TUESDAY, WEDNESDAY))

        for (day in listOf(TUESDAY, WEDNESDAY)) {
            val meals = diet.getMeals(day)
            assertEquals(listOf("Breakfast", "Lunch"), meals.map { it.name })
            assertEquals("08:00", meals[0].time)
            assertEquals(listOf("Oats" to "80 g"), meals[0].foods.map { it.name to it.quantity })
        }
    }

    @Test
    fun `leaves the source and other days untouched`() = runTest {
        diet.addMeal(MONDAY, "Breakfast", "")
        diet.addMeal(FRIDAY, "Pizza", "")

        copyDay(MONDAY, setOf(MONDAY, TUESDAY))

        assertEquals(listOf("Breakfast"), diet.getMeals(MONDAY).map { it.name })
        assertEquals(listOf("Pizza"), diet.getMeals(FRIDAY).map { it.name })
    }
}
