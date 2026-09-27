package com.nickghignatti.tracker.data.repository

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.nickghignatti.tracker.data.local.AppDatabase
import java.time.DayOfWeek.MONDAY
import java.time.DayOfWeek.TUESDAY
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class RoomDietRepositoryTest {

    private lateinit var db: AppDatabase
    private lateinit var diet: RoomDietRepository

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AppDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        diet = RoomDietRepository(db)
    }

    @After
    fun tearDown() = db.close()

    @Test
    fun `meals and foods keep insertion order per day`() = runTest {
        val breakfast = diet.addMeal(MONDAY, "Breakfast", "08:00")
        diet.addMeal(MONDAY, "Lunch", "")
        diet.addMeal(TUESDAY, "Other day", "")
        diet.addFood(breakfast, "Oats", "80 g")
        diet.addFood(breakfast, "Milk", "200 ml")

        val meals = diet.observeMeals(MONDAY).first()

        assertEquals(listOf("Breakfast", "Lunch"), meals.map { it.name })
        assertEquals(listOf("Oats", "Milk"), meals.first().foods.map { it.name })
    }

    @Test
    fun `updating and deleting foods`() = runTest {
        val meal = diet.addMeal(MONDAY, "Breakfast", "")
        diet.addFood(meal, "Oats", "80 g")
        diet.addFood(meal, "Milk", "200 ml")
        val (oats, milk) = diet.getMeals(MONDAY).single().foods

        diet.updateFood(oats.id, "Oats", "100 g")
        diet.deleteFood(milk.id)

        assertEquals(listOf("Oats" to "100 g"), diet.getMeals(MONDAY).single().foods.map { it.name to it.quantity })
    }

    @Test
    fun `replace meals swaps the whole day`() = runTest {
        val breakfast = diet.addMeal(MONDAY, "Breakfast", "08:00")
        diet.addFood(breakfast, "Oats", "80 g")
        diet.addMeal(TUESDAY, "Old", "")

        diet.replaceMeals(TUESDAY, diet.getMeals(MONDAY))

        val tuesday = diet.getMeals(TUESDAY).single()
        assertEquals("Breakfast", tuesday.name)
        assertEquals(TUESDAY, tuesday.day)
        assertEquals(listOf("Oats"), tuesday.foods.map { it.name })
        assertEquals(1, diet.getMeals(MONDAY).size)
    }

    @Test
    fun `deleting a meal removes its foods`() = runTest {
        val meal = diet.addMeal(MONDAY, "Breakfast", "")
        diet.addFood(meal, "Oats", "80 g")

        diet.deleteMeal(meal)

        assertTrue(diet.getMeals(MONDAY).isEmpty())
        val orphanFoods = db.query("SELECT COUNT(*) FROM foods", null).use { it.moveToFirst(); it.getInt(0) }
        assertEquals(0, orphanFoods)
    }
}
