package com.nickghignatti.tracker.ui.diet

import com.nickghignatti.tracker.MainDispatcherRule
import com.nickghignatti.tracker.domain.fake.FakeDietRepository
import com.nickghignatti.tracker.domain.fake.ImmediateTransactionRunner
import com.nickghignatti.tracker.domain.usecase.CopyDietDayUseCase
import java.time.Clock
import java.time.DayOfWeek.MONDAY
import java.time.DayOfWeek.SATURDAY
import java.time.DayOfWeek.SUNDAY
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DietViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    // 26 Sep 2026 is a Saturday.
    private val clock = Clock.fixed(LocalDate.of(2026, 9, 26).atStartOfDay().toInstant(ZoneOffset.UTC), ZoneOffset.UTC)
    private val diet = FakeDietRepository()
    // Created lazily so viewModelScope binds to the dispatcher installed by the rule.
    private val viewModel by lazy { DietViewModel(clock, diet, CopyDietDayUseCase(diet, ImmediateTransactionRunner())) }

    @Test
    fun `starts on today's weekday`() = runTest {
        diet.addMeal(SATURDAY, "Pizza", "")
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }

        val state = viewModel.uiState.value
        assertEquals(SATURDAY, state.selectedDay)
        assertEquals(SATURDAY, state.today)
        assertEquals(listOf("Pizza"), state.meals.map { it.name })
    }

    @Test
    fun `selecting a day shows its meals`() = runTest {
        diet.addMeal(MONDAY, "Oats", "")
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }

        viewModel.onAction(DietAction.SelectDay(MONDAY))

        assertEquals(MONDAY, viewModel.uiState.value.selectedDay)
        assertEquals(listOf("Oats"), viewModel.uiState.value.meals.map { it.name })
    }

    @Test
    fun `new meals go to the selected day, trimmed`() = runTest {
        viewModel.onAction(DietAction.SelectDay(MONDAY))

        viewModel.onAction(DietAction.AddMeal("  Lunch ", " 13:00 "))

        val meal = diet.getMeals(MONDAY).single()
        assertEquals("Lunch", meal.name)
        assertEquals("13:00", meal.time)
    }

    @Test
    fun `copy day copies the selected day`() = runTest {
        diet.addMeal(SATURDAY, "Pizza", "")

        viewModel.onAction(DietAction.CopyDay(setOf(SUNDAY)))

        assertEquals(listOf("Pizza"), diet.getMeals(SUNDAY).map { it.name })
    }
}
