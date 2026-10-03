package com.nickghignatti.tracker.domain.model

import com.nickghignatti.tracker.domain.fake.basicFood
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FoodTest {

    private val pasta = FoodItem(FoodId(FoodSource.BASIC, "1"), "Pasta di semola", Nutrients(350.0, 12.0, 70.0, 1.5))

    @Test
    fun `a portion scales the nutrition per 100 g`() {
        val nutrients = Portion(pasta, grams = 80.0).nutrients
        assertEquals(280.0, nutrients.kcal, 0.001)
        assertEquals(9.6, nutrients.protein, 0.001)
        assertEquals(56.0, nutrients.carbs, 0.001)
        assertEquals(1.2, nutrients.fat, 0.001)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `a portion needs a positive amount`() {
        Portion(pasta, grams = 0.0)
    }

    @Test
    fun `food ids round-trip through their text form`() {
        val id = FoodId(FoodSource.PRODUCT, "8076800195057")
        assertEquals("off:8076800195057", id.toString())
        assertEquals(id, FoodId.parse(id.toString()))
    }

    @Test
    fun `a meal counts only foods with nutrition data`() {
        val meal = Meal(
            id = 1,
            name = "Pranzo",
            time = "",
            foods = listOf(
                Food(1, "Pasta di semola", "", Portion(pasta, 80.0)),
                Food(2, "Insalata", "q.b."),
            ),
        )

        assertEquals(280.0, meal.nutrients!!.kcal, 0.001)
        assertNull(meal.copy(foods = meal.foods.drop(1)).nutrients)
    }

    @Test
    fun `search ignores case and accents, and matches singular with plural`() {
        val foods = listOf(
            basicFood("1", "Mele, golden, con buccia"),
            basicFood("2", "Caffè, infusione"),
            basicFood("3", "Uova di gallina, intero"),
            basicFood("4", "Pasta di semola, cruda"),
            basicFood("5", "Pane, tipo 00"),
            basicFood("6", "Pollo, petto, senza pelle, crudo"),
        )

        assertEquals(listOf("1"), FoodSearch.rank("mela", foods) { it.name }.map { it.id.key })
        assertEquals(listOf("2"), FoodSearch.rank("CAFFE", foods) { it.name }.map { it.id.key })
        assertEquals(listOf("3"), FoodSearch.rank("uovo", foods) { it.name }.map { it.id.key })
        assertEquals(listOf("4"), FoodSearch.rank("pasta cruda", foods) { it.name }.map { it.id.key })
        assertEquals(listOf("6"), FoodSearch.rank("petto di pollo", foods) { it.name }.map { it.id.key })
        assertEquals(emptyList<FoodItem>(), FoodSearch.rank("  ", foods) { it.name })
    }

    @Test
    fun `search puts names starting with the query first, then shorter ones`() {
        val foods = listOf(
            basicFood("1", "Biscotti al latte"),
            basicFood("2", "Latte di vacca, parzialmente scremato"),
            basicFood("3", "Latte di vacca, intero"),
        )

        assertEquals(listOf("3", "2", "1"), FoodSearch.rank("latte", foods) { it.name }.map { it.id.key })
    }
}
