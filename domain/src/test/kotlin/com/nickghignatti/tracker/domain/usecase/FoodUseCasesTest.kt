package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.fake.FakeBasicFoodRepository
import com.nickghignatti.tracker.domain.fake.FakeCustomFoodRepository
import com.nickghignatti.tracker.domain.fake.FakeDietPlanRepository
import com.nickghignatti.tracker.domain.fake.FakeFoodLogRepository
import com.nickghignatti.tracker.domain.fake.FakeProductRepository
import com.nickghignatti.tracker.domain.fake.FakeSavedProductRepository
import com.nickghignatti.tracker.domain.fake.ImmediateTransactionRunner
import com.nickghignatti.tracker.domain.fake.basicFood
import com.nickghignatti.tracker.domain.model.FoodId
import com.nickghignatti.tracker.domain.model.FoodItem
import com.nickghignatti.tracker.domain.model.FoodSource
import com.nickghignatti.tracker.domain.model.Nutrients
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Portion
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.repository.ProductLookup
import java.time.LocalDate
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FoodUseCasesTest {

    private val foodLog = FakeFoodLogRepository()
    private val dietPlans = FakeDietPlanRepository()
    private val observeDay = ObserveCalorieDayUseCase(foodLog, dietPlans)
    private val defaults = listOf("Colazione", "Pranzo", "Cena")

    private val today = LocalDate.of(2026, 10, 3)
    private val oats = basicFood("1", "Avena, fiocchi", kcal = 370.0)
    private val milk = basicFood("2", "Latte parzialmente scremato", kcal = 46.0)
    private val pasta = basicFood("3", "Pasta di semola", kcal = 350.0)
    private val conadBar = FoodItem(FoodId(FoodSource.PRODUCT, "1"), "Barretta ai cereali", Nutrients(420.0, 6.0, 70.0, 12.0), brand = "Conad")

    private suspend fun activeDietWithBreakfast(): Long {
        val plan = dietPlans.createPlan("Cut", Recurrence.DAILY)
        val breakfast = dietPlans.addMeal(plan, PlanDay.EveryDay, "Colazione", "08:00")
        dietPlans.addFood(breakfast, oats.name, "", Portion(oats, 50.0))
        dietPlans.addFood(breakfast, milk.name, "", Portion(milk, 200.0))
        dietPlans.addFood(breakfast, "Caffè", "1 tazzina")
        dietPlans.addMeal(plan, PlanDay.EveryDay, "Pranzo", "13:00")
        dietPlans.setActivePlan(plan)
        return plan
    }

    @Test
    fun `without a diet the day has the default meals, plus any other logged under another name`() = runTest {
        foodLog.addEntry(today, "Merenda", Portion(oats, 30.0))
        foodLog.addEntry(today, "Pranzo", Portion(pasta, 80.0))

        val day = observeDay(today, defaults).first()

        assertEquals(listOf("Colazione", "Pranzo", "Cena", "Merenda"), day.meals.map { it.name })
        assertEquals(listOf(pasta), day.meals[1].entries.map { it.portion.food })
        assertEquals(280.0 + 111.0, day.eaten.kcal, 0.001)
        assertNull(day.planned)
        assertFalse(day.hasDietPlan)
    }

    @Test
    fun `with a diet the day follows its meals and compares eaten with planned`() = runTest {
        activeDietWithBreakfast()
        foodLog.addEntry(today, "Pranzo", Portion(pasta, 100.0))

        val day = observeDay(today, defaults).first()

        assertEquals(listOf("Colazione", "Pranzo"), day.meals.map { it.name })
        assertEquals(185.0 + 92.0, day.planned!!.kcal, 0.001)
        assertEquals(350.0, day.eaten.kcal, 0.001)
        assertTrue(day.meals[0].canLogAsPlanned)
        assertFalse("a planned meal without nutrition data has nothing to log", day.meals[1].canLogAsPlanned)
    }

    @Test
    fun `logging a planned meal logs its linked foods and skips free text`() = runTest {
        activeDietWithBreakfast()
        val breakfast = observeDay(today, defaults).first().meals.first().planned!!

        val logged = LogPlannedMealUseCase(foodLog, ImmediateTransactionRunner())(today, breakfast)

        assertEquals(2, logged)
        val day = observeDay(today, defaults).first()
        assertEquals(listOf(oats, milk), day.meals.first().entries.map { it.portion.food })
        assertFalse(day.meals.first().canLogAsPlanned)
        assertEquals(day.planned!!.kcal, day.eaten.kcal, 0.001)
    }

    @Test
    fun `search lists the user's own foods and saved products together with the basic ones`() = runTest {
        val custom = FakeCustomFoodRepository()
        val myBar = custom.create("Barretta proteica fatta in casa", Nutrients(400.0, 30.0, 40.0, 12.0), null, 40.0)
        val saved = FakeSavedProductRepository().apply { save(conadBar) }
        val search = SearchFoodsUseCase(FakeBasicFoodRepository(listOf(basicFood("9", "Barretta al cioccolato"))), custom, saved)

        assertEquals(listOf("Barretta al cioccolato", conadBar.name, myBar.name), search("barretta").map { it.name })
    }

    @Test
    fun `search matches brands too`() = runTest {
        val saved = FakeSavedProductRepository().apply {
            save(conadBar)
            save(conadBar.copy(id = FoodId(FoodSource.PRODUCT, "2"), name = "Conad", brand = "Conad"))
        }
        val search = SearchFoodsUseCase(FakeBasicFoodRepository(listOf(basicFood("9", "Barretta al cioccolato"))), FakeCustomFoodRepository(), saved)

        assertEquals(listOf(conadBar), search("barretta conad"))
    }

    @Test
    fun `barcode lookups save the product, and work offline once saved`() = runTest {
        val products = FakeProductRepository(listOf("1" to conadBar))
        val saved = FakeSavedProductRepository()
        val lookUp = LookUpBarcodeUseCase(products, saved)

        assertEquals(ProductLookup.Found(conadBar), lookUp("1"))
        assertEquals(listOf(conadBar), saved.products)

        products.available = false
        assertEquals(ProductLookup.Found(conadBar), lookUp("1"))
        assertEquals(ProductLookup.Unavailable, lookUp("2"))

        products.available = true
        assertEquals(ProductLookup.NotFound, lookUp("2"))
    }

    @Test
    fun `recent foods are distinct, newest first`() = runTest {
        foodLog.addEntry(today, "Colazione", Portion(oats, 50.0))
        foodLog.addEntry(today, "Pranzo", Portion(pasta, 80.0))
        foodLog.addEntry(today.plusDays(1), "Colazione", Portion(oats, 40.0))

        assertEquals(listOf(oats, pasta), foodLog.observeRecentFoods(10).first())
    }
}
