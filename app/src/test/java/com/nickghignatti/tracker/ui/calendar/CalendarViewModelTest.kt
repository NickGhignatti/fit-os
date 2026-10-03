package com.nickghignatti.tracker.ui.calendar

import com.nickghignatti.tracker.MainDispatcherRule
import com.nickghignatti.tracker.domain.fake.FakeTrainingPlanRepository
import com.nickghignatti.tracker.domain.fake.FakeWorkoutRepository
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import java.time.Clock
import java.time.DayOfWeek.MONDAY
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
class CalendarViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    // Thursday 17 Sep 2026; the Mondays of that month are the 7th, 14th, 21st and 28th.
    private val today = LocalDate.of(2026, 9, 17)
    private val clock = Clock.fixed(today.atStartOfDay().toInstant(ZoneOffset.UTC), ZoneOffset.UTC)
    private val trainingPlans = FakeTrainingPlanRepository()
    // Created lazily so viewModelScope binds to the dispatcher installed by the rule.
    private val viewModel by lazy { CalendarViewModel(clock, FakeWorkoutRepository(), trainingPlans) }

    @Test
    fun `upcoming days of the active plan are planned, past ones are not`() = runTest {
        val squat = ExercisePlan.uniform("Squat", "", 3, 5, 100.0)
        val plan = trainingPlans.createPlan("Split", Recurrence.WEEKLY, mapOf(PlanDay.Weekday(MONDAY) to listOf(squat)))
        trainingPlans.setActivePlan(plan)
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }

        assertEquals(setOf(LocalDate.of(2026, 9, 21), LocalDate.of(2026, 9, 28)), viewModel.uiState.value.plannedDays)
    }
}
