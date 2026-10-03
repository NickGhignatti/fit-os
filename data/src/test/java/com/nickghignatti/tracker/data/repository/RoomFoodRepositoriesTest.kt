package com.nickghignatti.tracker.data.repository

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.nickghignatti.tracker.data.local.AppDatabase
import com.nickghignatti.tracker.domain.model.FoodId
import com.nickghignatti.tracker.domain.model.FoodItem
import com.nickghignatti.tracker.domain.model.FoodSource
import com.nickghignatti.tracker.domain.model.Nutrients
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Portion
import com.nickghignatti.tracker.domain.model.Recurrence
import java.time.LocalDate
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
class RoomFoodRepositoriesTest {

    private lateinit var db: AppDatabase

    private val today = LocalDate.of(2026, 10, 3)
    private val oats = FoodItem(FoodId(FoodSource.BASIC, "009100"), "Avena, fiocchi", Nutrients(370.0, 13.0, 60.0, 7.0), servingGrams = 40.0)
    private val yogurt = FoodItem(FoodId(FoodSource.PRODUCT, "8012666051236"), "Yogurt greco", Nutrients(59.0, 10.0, 4.0, 0.2), brand = "Carrefour")

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AppDatabase::class.java)
            .allowMainThreadQueries()
            .build()
    }

    @After
    fun tearDown() = db.close()

    @Test
    fun `log entries round-trip per day, with their food snapshot`() = runTest {
        val log = RoomFoodLogRepository(db)
        val id = log.addEntry(today, "Colazione", Portion(oats, 50.0))
        log.addEntry(today, "Spuntino", Portion(yogurt, 170.0))
        log.addEntry(today.plusDays(1), "Colazione", Portion(oats, 40.0))

        log.updateGrams(id, 60.0)

        val entries = log.observeEntries(today).first()
        assertEquals(listOf("Colazione", "Spuntino"), entries.map { it.meal })
        assertEquals(Portion(oats, 60.0), entries.first().portion)
        assertEquals(yogurt, entries.last().portion.food)

        log.deleteEntry(id)
        assertEquals(1, log.observeEntries(today).first().size)
    }

    @Test
    fun `recent foods are distinct, latest first`() = runTest {
        val log = RoomFoodLogRepository(db)
        log.addEntry(today, "Colazione", Portion(oats, 50.0))
        log.addEntry(today, "Spuntino", Portion(yogurt, 170.0))
        log.addEntry(today.plusDays(1), "Colazione", Portion(oats, 40.0))

        assertEquals(listOf(oats, yogurt), log.observeRecentFoods(limit = 10).first())
        assertEquals(listOf(oats), log.observeRecentFoods(limit = 1).first())
    }

    @Test
    fun `custom foods get an id and are found by name`() = runTest {
        val custom = RoomCustomFoodRepository(db)

        val bar = custom.create("Barretta fatta in casa", Nutrients(400.0, 30.0, 40.0, 12.0), brand = null, servingGrams = 40.0)

        assertEquals(FoodSource.CUSTOM, bar.id.source)
        assertEquals(listOf(bar), custom.search("barrette"))
        assertTrue(custom.search("pizza").isEmpty())
    }

    @Test
    fun `favourites are newest first and can be removed`() = runTest {
        val favorites = RoomFavoriteFoodRepository(db)

        favorites.setFavorite(oats, true)
        favorites.setFavorite(yogurt, true)
        assertEquals(listOf(yogurt, oats), favorites.observeFavorites().first())

        favorites.setFavorite(yogurt, false)
        assertEquals(listOf(oats), favorites.observeFavorites().first())
    }

    @Test
    fun `saved products are found by barcode or by name and brand, and refreshed on save`() = runTest {
        val saved = RoomSavedProductRepository(db)

        saved.save(yogurt)
        saved.save(yogurt.copy(name = "Yogurt greco magro"))

        assertEquals("Yogurt greco magro", saved.find("8012666051236")?.name)
        assertEquals(listOf("Yogurt greco magro"), saved.search("yogurt carrefour").map { it.name })
        assertNull(saved.find("123"))
    }

    @Test
    fun `diet foods can be linked, re-linked and unlinked`() = runTest {
        val diet = RoomDietPlanRepository(db)
        val plan = diet.createPlan("Cut", Recurrence.DAILY)
        val meal = diet.addMeal(plan, PlanDay.EveryDay, "Colazione", "")
        diet.addFood(meal, oats.name, "", Portion(oats, 50.0))
        diet.addFood(meal, "Caffè", "1 tazzina")
        val (linked, text) = diet.getMeals(plan, PlanDay.EveryDay).single().foods

        assertEquals(Portion(oats, 50.0), linked.portion)
        assertNull(text.portion)

        diet.updateFood(linked.id, oats.name, "", Portion(oats, 70.0))
        diet.updateFood(text.id, "Caffè", "2 tazzine")
        val foods = diet.getMeals(plan, PlanDay.EveryDay).single().foods
        assertEquals(70.0, foods.first().portion!!.grams, 0.0)
        assertEquals("2 tazzine", foods.last().quantity)

        diet.replaceMeals(plan, PlanDay.EveryDay, diet.getMeals(plan, PlanDay.EveryDay))
        assertEquals(Portion(oats, 70.0), diet.getMeals(plan, PlanDay.EveryDay).single().foods.first().portion)
    }
}
