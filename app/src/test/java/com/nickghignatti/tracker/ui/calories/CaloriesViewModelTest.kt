package com.nickghignatti.tracker.ui.calories

import com.nickghignatti.tracker.MainDispatcherRule
import com.nickghignatti.tracker.domain.fake.FakeDietPlanRepository
import com.nickghignatti.tracker.domain.fake.FakeFoodLogRepository
import com.nickghignatti.tracker.domain.fake.FakeProfileRepository
import com.nickghignatti.tracker.domain.fake.FakeWeightRepository
import com.nickghignatti.tracker.domain.fake.ImmediateTransactionRunner
import com.nickghignatti.tracker.domain.fake.basicFood
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Portion
import com.nickghignatti.tracker.domain.model.Profile
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.usecase.LogPlannedMealUseCase
import com.nickghignatti.tracker.domain.usecase.ObserveCalorieDayUseCase
import com.nickghignatti.tracker.domain.usecase.ObserveDailyTargetsUseCase
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CaloriesViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val today = LocalDate.of(2026, 10, 3)
    private val clock = Clock.fixed(today.atStartOfDay().toInstant(ZoneOffset.UTC), ZoneOffset.UTC)
    private val foodLog = FakeFoodLogRepository()
    private val dietPlans = FakeDietPlanRepository()
    private val profiles = FakeProfileRepository()
    private val weights = FakeWeightRepository()
    private val oats = basicFood("1", "Avena", kcal = 370.0)
    // Created lazily so viewModelScope binds to the dispatcher installed by the rule.
    private val viewModel by lazy {
        CaloriesViewModel(
            clock = clock,
            observeCalorieDay = ObserveCalorieDayUseCase(foodLog, dietPlans),
            defaultMealNames = { listOf("Colazione", "Pranzo", "Cena") },
            observeDailyTargets = ObserveDailyTargetsUseCase(profiles, weights),
            foodLog = foodLog,
            logPlannedMeal = LogPlannedMealUseCase(foodLog, ImmediateTransactionRunner()),
        )
    }

    @Test
    fun `starts on today with the default meals`() = runTest {
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }

        val state = viewModel.uiState.value
        assertEquals(today, state.date)
        assertEquals(listOf("Colazione", "Pranzo", "Cena"), state.day.meals.map { it.name })
    }

    @Test
    fun `the daily goal comes from the profile`() = runTest {
        profiles.saveProfile(Profile(customKcal = 2_000.0))
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }

        assertEquals(2_000.0, viewModel.uiState.value.targets!!.nutrients.kcal, 0.0)
    }

    @Test
    fun `moving between days shows each day's log`() = runTest {
        foodLog.addEntry(today.minusDays(1), "Colazione", Portion(oats, 50.0))
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }

        viewModel.onAction(CaloriesAction.PreviousDay)
        assertEquals(185.0, viewModel.uiState.value.day.eaten.kcal, 0.001)

        viewModel.onAction(CaloriesAction.GoToToday)
        assertEquals(today, viewModel.uiState.value.date)
        assertEquals(0.0, viewModel.uiState.value.day.eaten.kcal, 0.0)
    }

    @Test
    fun `a planned meal is logged in one go, then entries can be edited and removed`() = runTest {
        val plan = dietPlans.createPlan("Cut", Recurrence.DAILY)
        val breakfast = dietPlans.addMeal(plan, PlanDay.EveryDay, "Colazione", "08:00")
        dietPlans.addFood(breakfast, oats.name, "", Portion(oats, 50.0))
        dietPlans.setActivePlan(plan)
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }

        viewModel.onAction(CaloriesAction.LogAsPlanned(viewModel.uiState.value.day.meals.first().planned!!))
        val entry = foodLog.entries.single()
        assertEquals("Colazione", entry.meal)

        viewModel.onAction(CaloriesAction.UpdateGrams(entry.id, 80.0))
        assertEquals(296.0, viewModel.uiState.value.day.eaten.kcal, 0.001)

        viewModel.onAction(CaloriesAction.DeleteEntry(entry.id))
        assertTrue(foodLog.entries.isEmpty())
    }
}
