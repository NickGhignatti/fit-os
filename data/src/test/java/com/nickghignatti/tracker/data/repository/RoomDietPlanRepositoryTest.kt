package com.nickghignatti.tracker.data.repository

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.nickghignatti.tracker.data.local.AppDatabase
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import java.time.DayOfWeek.MONDAY
import java.time.DayOfWeek.TUESDAY
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class RoomDietPlanRepositoryTest {

    private lateinit var db: AppDatabase
    private lateinit var diet: RoomDietPlanRepository

    private val monday = PlanDay.Weekday(MONDAY)
    private val tuesday = PlanDay.Weekday(TUESDAY)

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AppDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        diet = RoomDietPlanRepository(db)
    }

    @After
    fun tearDown() = db.close()

    @Test
    fun `meals and foods keep insertion order per day`() = runTest {
        val plan = diet.createPlan("Cut", Recurrence.WEEKLY)
        val breakfast = diet.addMeal(plan, monday, "Breakfast", "08:00")
        diet.addMeal(plan, monday, "Lunch", "")
        diet.addMeal(plan, tuesday, "Other day", "")
        diet.addFood(breakfast, "Oats", "80 g")
        diet.addFood(breakfast, "Milk", "200 ml")

        val stored = diet.observePlan(plan).first()!!

        assertEquals(listOf("Breakfast", "Lunch"), stored.mealsOn(monday).map { it.name })
        assertEquals(listOf("Oats", "Milk"), stored.mealsOn(monday).first().foods.map { it.name })
        assertEquals(listOf(monday, tuesday), stored.plannedDays)
    }

    @Test
    fun `a daily plan keeps its meals under every day`() = runTest {
        val plan = diet.createPlan("Maintenance", Recurrence.DAILY)
        diet.addMeal(plan, PlanDay.EveryDay, "Breakfast", "")

        val stored = diet.observePlan(plan).first()!!

        assertEquals(Recurrence.DAILY, stored.recurrence)
        assertEquals(listOf("Breakfast"), stored.mealsOn(java.time.LocalDate.of(2026, 10, 3)).map { it.name })
    }

    @Test
    fun `updating and deleting foods`() = runTest {
        val plan = diet.createPlan("Cut", Recurrence.WEEKLY)
        val meal = diet.addMeal(plan, monday, "Breakfast", "")
        diet.addFood(meal, "Oats", "80 g")
        diet.addFood(meal, "Milk", "200 ml")
        val (oats, milk) = diet.getMeals(plan, monday).single().foods

        diet.updateFood(oats.id, "Oats", "100 g")
        diet.deleteFood(milk.id)

        assertEquals(listOf("Oats" to "100 g"), diet.getMeals(plan, monday).single().foods.map { it.name to it.quantity })
    }

    @Test
    fun `replace meals swaps the whole day of that plan only`() = runTest {
        val plan = diet.createPlan("Cut", Recurrence.WEEKLY)
        val other = diet.createPlan("Bulk", Recurrence.WEEKLY)
        val breakfast = diet.addMeal(plan, monday, "Breakfast", "08:00")
        diet.addFood(breakfast, "Oats", "80 g")
        diet.addMeal(plan, tuesday, "Old", "")
        diet.addMeal(other, tuesday, "Steak", "")

        diet.replaceMeals(plan, tuesday, diet.getMeals(plan, monday))

        val tuesdayMeal = diet.getMeals(plan, tuesday).single()
        assertEquals("Breakfast", tuesdayMeal.name)
        assertEquals(listOf("Oats"), tuesdayMeal.foods.map { it.name })
        assertEquals(1, diet.getMeals(plan, monday).size)
        assertEquals(listOf("Steak"), diet.getMeals(other, tuesday).map { it.name })
    }

    @Test
    fun `only one plan is active at a time`() = runTest {
        val cut = diet.createPlan("Cut", Recurrence.WEEKLY)
        val bulk = diet.createPlan("Bulk", Recurrence.DAILY)

        diet.setActivePlan(cut)
        diet.setActivePlan(bulk)
        assertEquals(bulk, diet.getActivePlan()?.id)
        assertEquals(listOf(true, false), diet.observePlans().first().map { it.isActive })

        diet.setActivePlan(null)
        assertNull(diet.observeActivePlan().first())
    }

    @Test
    fun `deleting a plan removes its meals and foods`() = runTest {
        val plan = diet.createPlan("Cut", Recurrence.WEEKLY)
        val meal = diet.addMeal(plan, monday, "Breakfast", "")
        diet.addFood(meal, "Oats", "80 g")

        diet.deletePlan(plan)

        assertTrue(diet.observePlans().first().isEmpty())
        val orphans = db.query("SELECT (SELECT COUNT(*) FROM meals) + (SELECT COUNT(*) FROM foods)", null)
            .use { it.moveToFirst(); it.getInt(0) }
        assertEquals(0, orphans)
    }
}
