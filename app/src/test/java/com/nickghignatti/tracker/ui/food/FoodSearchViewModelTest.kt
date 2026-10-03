package com.nickghignatti.tracker.ui.food

import com.nickghignatti.tracker.MainDispatcherRule
import com.nickghignatti.tracker.domain.fake.FakeBasicFoodRepository
import com.nickghignatti.tracker.domain.fake.FakeCustomFoodRepository
import com.nickghignatti.tracker.domain.fake.FakeDietPlanRepository
import com.nickghignatti.tracker.domain.fake.FakeFavoriteFoodRepository
import com.nickghignatti.tracker.domain.fake.FakeFoodLogRepository
import com.nickghignatti.tracker.domain.fake.FakeProductRepository
import com.nickghignatti.tracker.domain.fake.FakeSavedProductRepository
import com.nickghignatti.tracker.domain.fake.basicFood
import com.nickghignatti.tracker.domain.model.FoodId
import com.nickghignatti.tracker.domain.model.FoodItem
import com.nickghignatti.tracker.domain.model.FoodSource
import com.nickghignatti.tracker.domain.model.Nutrients
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Portion
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.usecase.LookUpBarcodeUseCase
import com.nickghignatti.tracker.domain.usecase.SearchFoodsUseCase
import java.time.LocalDate
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class FoodSearchViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val today = LocalDate.of(2026, 10, 3)
    private val pasta = basicFood("1", "Pasta di semola, cruda", kcal = 350.0, servingGrams = 80.0)
    private val apples = basicFood("2", "Mele, golden")
    private val yogurt = FoodItem(FoodId(FoodSource.PRODUCT, "8012666051236"), "Yogurt greco magro", Nutrients(59.0, 10.0, 4.0, 0.2), "Carrefour")

    private val products = FakeProductRepository(listOf(yogurt.id.key to yogurt))
    private val customFoods = FakeCustomFoodRepository()
    private val savedProducts = FakeSavedProductRepository()
    private val favorites = FakeFavoriteFoodRepository()
    private val foodLog = FakeFoodLogRepository()
    private val dietPlans = FakeDietPlanRepository()

    private fun viewModel(target: FoodTarget = FoodTarget.Log(today, "Pranzo")) = FoodSearchViewModel(
        target = target,
        searchFoods = SearchFoodsUseCase(FakeBasicFoodRepository(listOf(pasta, apples)), customFoods, savedProducts),
        lookUpBarcode = LookUpBarcodeUseCase(products, savedProducts),
        products = products,
        savedProducts = savedProducts,
        customFoods = customFoods,
        favorites = favorites,
        foodLog = foodLog,
        dietPlans = dietPlans,
    )

    @Test
    fun `offline foods follow the query right away`() = runTest {
        val vm = viewModel()

        vm.onAction(FoodSearchAction.QueryChanged("mela"))

        assertEquals(listOf(apples), vm.uiState.value.localResults)
    }

    @Test
    fun `packaged products are searched only once typing pauses`() = runTest {
        val vm = viewModel()

        vm.onAction(FoodSearchAction.QueryChanged("yog"))
        advanceTimeBy(300)
        vm.onAction(FoodSearchAction.QueryChanged("yogurt"))
        advanceTimeBy(300)
        assertTrue(products.searches.isEmpty())

        advanceTimeBy(1_000)
        runCurrent()

        assertEquals(listOf("yogurt"), products.searches)
        assertEquals(ProductResults.Found(listOf(yogurt)), vm.uiState.value.products)
    }

    @Test
    fun `short queries do not search online, and being offline is reported`() = runTest {
        val vm = viewModel()

        vm.onAction(FoodSearchAction.QueryChanged("yo"))
        advanceTimeBy(1_000)
        runCurrent()
        assertEquals(ProductResults.Idle, vm.uiState.value.products)

        products.available = false
        vm.onAction(FoodSearchAction.QueryChanged("yogurt"))
        advanceTimeBy(1_000)
        runCurrent()
        assertEquals(ProductResults.Unavailable, vm.uiState.value.products)
    }

    @Test
    fun `typed barcode digits look the product up directly`() = runTest {
        val vm = viewModel()

        vm.onAction(FoodSearchAction.QueryChanged(yogurt.id.key))
        advanceTimeBy(1_000)
        runCurrent()

        assertEquals(ProductResults.Found(listOf(yogurt)), vm.uiState.value.products)
        assertTrue("barcodes are not sent to the name search", products.searches.isEmpty())
    }

    @Test
    fun `picking an amount logs the food under the meal, then closes`() = runTest {
        val vm = viewModel()

        vm.onAction(FoodSearchAction.Pick(pasta))
        vm.onAction(FoodSearchAction.ConfirmAmount(90.0))

        assertEquals(FoodSearchEvent.Added, vm.events.first())
        val entry = foodLog.entries.single()
        assertEquals(today, entry.date)
        assertEquals("Pranzo", entry.meal)
        assertEquals(Portion(pasta, 90.0), entry.portion)
        assertNull(vm.uiState.value.picked)
    }

    @Test
    fun `for a diet meal the food is linked into the plan`() = runTest {
        val plan = dietPlans.createPlan("Cut", Recurrence.DAILY)
        val lunch = dietPlans.addMeal(plan, PlanDay.EveryDay, "Pranzo", "")
        val vm = viewModel(FoodTarget.DietMeal(lunch, "Pranzo"))

        vm.onAction(FoodSearchAction.Pick(pasta))
        vm.onAction(FoodSearchAction.ConfirmAmount(80.0))
        vm.onAction(FoodSearchAction.AddAsText("Insalata", "q.b."))

        val foods = dietPlans.getMeals(plan, PlanDay.EveryDay).single().foods
        assertEquals(Portion(pasta, 80.0), foods.first().portion)
        assertEquals("Insalata" to "q.b.", foods.last().name to foods.last().quantity)
        assertNull(foods.last().portion)
        assertTrue(foodLog.entries.isEmpty())
    }

    @Test
    fun `an added product is saved, then found offline and listed once`() = runTest {
        val vm = viewModel()

        vm.onAction(FoodSearchAction.Pick(yogurt))
        vm.onAction(FoodSearchAction.ConfirmAmount(170.0))
        assertEquals(listOf(yogurt), savedProducts.products)

        vm.onAction(FoodSearchAction.QueryChanged("yogurt carrefour"))
        advanceTimeBy(1_000)
        runCurrent()

        assertEquals(listOf(yogurt), vm.uiState.value.localResults)
        assertEquals(ProductResults.Found(listOf(yogurt)), vm.uiState.value.products)
        assertTrue("already listed offline", vm.uiState.value.onlineProducts.isEmpty())
    }

    @Test
    fun `a scanned barcode opens its product, or explains why not`() = runTest {
        val vm = viewModel()

        vm.onAction(FoodSearchAction.BarcodeScanned(yogurt.id.key))
        assertEquals(yogurt, vm.uiState.value.picked)

        vm.onAction(FoodSearchAction.DismissPick)
        vm.onAction(FoodSearchAction.BarcodeScanned("123"))
        assertEquals(FoodSearchEvent.ProductNotFound("123"), vm.events.first())

        products.available = false
        vm.onAction(FoodSearchAction.BarcodeScanned("8000000000001"))
        assertEquals(FoodSearchEvent.ProductsUnavailable, vm.events.first())
        assertNull(vm.uiState.value.picked)

        // Scanned once already, so it is saved and opens offline too.
        vm.onAction(FoodSearchAction.BarcodeScanned(yogurt.id.key))
        assertEquals(yogurt, vm.uiState.value.picked)
    }

    @Test
    fun `a new custom food is saved and opened for its amount`() = runTest {
        val vm = viewModel()

        vm.onAction(FoodSearchAction.CreateCustomFood("Torta della nonna", Nutrients(380.0, 6.0, 50.0, 17.0), 120.0))

        val created = customFoods.foods.single()
        assertEquals(created, vm.uiState.value.picked)
        vm.onAction(FoodSearchAction.QueryChanged("torta"))
        assertEquals(listOf(created), vm.uiState.value.localResults)
    }

    @Test
    fun `favourites toggle, and recent foods skip them`() = runTest {
        foodLog.addEntry(today, "Pranzo", Portion(pasta, 80.0))
        foodLog.addEntry(today, "Spuntino", Portion(apples, 150.0))
        val vm = viewModel()

        vm.onAction(FoodSearchAction.ToggleFavorite(pasta))
        assertEquals(listOf(pasta), vm.uiState.value.favorites)
        assertEquals(listOf(apples), vm.uiState.value.recentNotFavorite)

        vm.onAction(FoodSearchAction.ToggleFavorite(pasta))
        assertTrue(vm.uiState.value.favorites.isEmpty())
    }
}
