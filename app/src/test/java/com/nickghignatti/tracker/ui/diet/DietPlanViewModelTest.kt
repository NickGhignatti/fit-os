package com.nickghignatti.tracker.ui.diet

import com.nickghignatti.tracker.MainDispatcherRule
import com.nickghignatti.tracker.domain.fake.FakeDietPlanRepository
import com.nickghignatti.tracker.domain.fake.ImmediateTransactionRunner
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.usecase.CopyDietDayUseCase
import java.time.Clock
import java.time.DayOfWeek.MONDAY
import java.time.DayOfWeek.SATURDAY
import java.time.DayOfWeek.SUNDAY
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DietPlanViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    // 26 Sep 2026 is a Saturday.
    private val clock = Clock.fixed(LocalDate.of(2026, 9, 26).atStartOfDay().toInstant(ZoneOffset.UTC), ZoneOffset.UTC)
    private val diet = FakeDietPlanRepository()

    private fun TestScope.viewModel(planId: Long) =
        DietPlanViewModel(planId, clock, diet, CopyDietDayUseCase(diet, ImmediateTransactionRunner())).also { vm ->
            backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.uiState.collect {} }
        }

    @Test
    fun `a weekly plan starts on today's weekday`() = runTest {
        val plan = diet.createPlan("Cut", Recurrence.WEEKLY)
        diet.addMeal(plan, PlanDay.Weekday(SATURDAY), "Pizza", "")

        val state = viewModel(plan).uiState.value

        assertEquals(SATURDAY, state.selectedDay)
        assertEquals(PlanDay.Weekday(SATURDAY), state.planDay)
        assertEquals(listOf("Pizza"), state.meals.map { it.name })
    }

    @Test
    fun `selecting a day shows its meals`() = runTest {
        val plan = diet.createPlan("Cut", Recurrence.WEEKLY)
        diet.addMeal(plan, PlanDay.Weekday(MONDAY), "Oats", "")
        val vm = viewModel(plan)

        vm.onAction(DietPlanAction.SelectDay(MONDAY))

        assertEquals(MONDAY, vm.uiState.value.selectedDay)
        assertEquals(listOf("Oats"), vm.uiState.value.meals.map { it.name })
    }

    @Test
    fun `a daily plan shows the same meals whatever the day`() = runTest {
        val plan = diet.createPlan("Maintenance", Recurrence.DAILY)
        diet.addMeal(plan, PlanDay.EveryDay, "Oats", "")
        val vm = viewModel(plan)

        vm.onAction(DietPlanAction.SelectDay(MONDAY))

        assertEquals(PlanDay.EveryDay, vm.uiState.value.planDay)
        assertEquals(listOf("Oats"), vm.uiState.value.meals.map { it.name })
    }

    @Test
    fun `new meals go to the given day, trimmed`() = runTest {
        val plan = diet.createPlan("Cut", Recurrence.WEEKLY)

        viewModel(plan).onAction(DietPlanAction.AddMeal(PlanDay.Weekday(MONDAY), "  Lunch ", " 13:00 "))

        val meal = diet.getMeals(plan, PlanDay.Weekday(MONDAY)).single()
        assertEquals("Lunch", meal.name)
        assertEquals("13:00", meal.time)
    }

    @Test
    fun `copy day copies within the plan`() = runTest {
        val plan = diet.createPlan("Cut", Recurrence.WEEKLY)
        diet.addMeal(plan, PlanDay.Weekday(SATURDAY), "Pizza", "")

        viewModel(plan).onAction(DietPlanAction.CopyDay(SATURDAY, setOf(SUNDAY)))

        assertEquals(listOf("Pizza"), diet.getMeals(plan, PlanDay.Weekday(SUNDAY)).map { it.name })
    }

    @Test
    fun `a deleted plan leaves nothing to edit`() = runTest {
        val plan = diet.createPlan("Cut", Recurrence.WEEKLY)
        val vm = viewModel(plan)

        diet.deletePlan(plan)

        assertNull(vm.uiState.value.plan)
    }
}
