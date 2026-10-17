package com.nickghignatti.tracker.ui.today

import com.nickghignatti.tracker.MainDispatcherRule
import com.nickghignatti.tracker.domain.fake.FakeDietPlanRepository
import com.nickghignatti.tracker.domain.fake.FakeFoodLogRepository
import com.nickghignatti.tracker.domain.fake.FakeProfileRepository
import com.nickghignatti.tracker.domain.fake.FakeTrainingPlanRepository
import com.nickghignatti.tracker.domain.fake.FakeWeightRepository
import com.nickghignatti.tracker.domain.fake.FakeWorkoutRepository
import com.nickghignatti.tracker.domain.fake.ImmediateTransactionRunner
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.usecase.LogPlannedMealUseCase
import com.nickghignatti.tracker.domain.usecase.ObserveCalorieDayUseCase
import com.nickghignatti.tracker.domain.usecase.ObserveDailyTargetsUseCase
import com.nickghignatti.tracker.domain.usecase.ObserveDayAgendaUseCase
import com.nickghignatti.tracker.domain.usecase.StartPlannedSessionUseCase
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class TodayViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val today = LocalDate.of(2026, 9, 26)
    private val clock = Clock.fixed(today.atStartOfDay().toInstant(ZoneOffset.UTC), ZoneOffset.UTC)
    private val workouts = FakeWorkoutRepository()
    private val trainingPlans = FakeTrainingPlanRepository()
    private val dietPlans = FakeDietPlanRepository()
    private val foodLog = FakeFoodLogRepository()
    // Created lazily so viewModelScope binds to the dispatcher installed by the rule.
    private val viewModel by lazy {
        TodayViewModel(
            clock,
            ObserveDayAgendaUseCase(workouts, trainingPlans, dietPlans),
            ObserveCalorieDayUseCase(foodLog, dietPlans),
            ObserveDailyTargetsUseCase(FakeProfileRepository(), FakeWeightRepository()),
            { listOf("Breakfast", "Lunch") },
            StartPlannedSessionUseCase(workouts, trainingPlans, ImmediateTransactionRunner()),
            LogPlannedMealUseCase(foodLog, ImmediateTransactionRunner()),
        )
    }

    @Test
    fun `starting the planned session creates today's workout and opens the day`() = runTest {
        val squat = ExercisePlan.uniform("Squat", "", sets = 3, reps = 5, weight = 100.0)
        val plan = trainingPlans.createPlan("Full body", Recurrence.DAILY, mapOf(PlanDay.EveryDay to listOf(squat)))
        trainingPlans.setActivePlan(plan)

        viewModel.onAction(TodayAction.StartPlannedSession)

        assertEquals(TodayEvent.SessionStarted(today), viewModel.events.first())
        assertEquals(today, workouts.workouts.single().date)
    }

    @Test
    fun `nothing happens without an active plan`() = runTest {
        viewModel.onAction(TodayAction.StartPlannedSession)

        assertTrue(workouts.workouts.isEmpty())
    }
}
