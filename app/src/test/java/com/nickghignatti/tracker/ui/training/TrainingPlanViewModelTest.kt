package com.nickghignatti.tracker.ui.training

import com.nickghignatti.tracker.MainDispatcherRule
import com.nickghignatti.tracker.domain.fake.FakeTrainingPlanRepository
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.model.SetPlan
import com.nickghignatti.tracker.domain.usecase.AddPlannedSetUseCase
import java.time.Clock
import java.time.DayOfWeek.MONDAY
import java.time.DayOfWeek.SATURDAY
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class TrainingPlanViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    // 26 Sep 2026 is a Saturday.
    private val clock = Clock.fixed(LocalDate.of(2026, 9, 26).atStartOfDay().toInstant(ZoneOffset.UTC), ZoneOffset.UTC)
    private val plans = FakeTrainingPlanRepository()
    private val squat = ExercisePlan.uniform("Squat", "", sets = 2, reps = 5, weight = 100.0)

    private fun TestScope.viewModel(planId: Long) =
        TrainingPlanViewModel(planId, clock, plans, AddPlannedSetUseCase(plans)).also { vm ->
            backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.uiState.collect {} }
        }

    @Test
    fun `a weekly plan is edited day by day, starting today`() = runTest {
        val id = plans.createPlan("Split", Recurrence.WEEKLY, mapOf(PlanDay.Weekday(MONDAY) to listOf(squat)))
        val vm = viewModel(id)
        assertEquals(PlanDay.Weekday(SATURDAY), vm.uiState.value.planDay)
        assertTrue(vm.uiState.value.exercises.isEmpty())

        vm.onAction(TrainingPlanAction.SelectDay(MONDAY))

        assertEquals(listOf("Squat"), vm.uiState.value.exercises.map { it.name })
    }

    @Test
    fun `sets can be added, changed and removed`() = runTest {
        val id = plans.createPlan("Full body", Recurrence.DAILY, mapOf(PlanDay.EveryDay to listOf(squat)))
        val vm = viewModel(id)
        val exercise = vm.uiState.value.exercises.single()

        vm.onAction(TrainingPlanAction.AddSet(exercise))
        vm.onAction(TrainingPlanAction.UpdateSet(exercise.sets.first().id, SetPlan(8, 90.0)))
        vm.onAction(TrainingPlanAction.DeleteSet(exercise.sets.last().id))

        assertEquals(
            listOf(SetPlan(8, 90.0), SetPlan(5, 100.0)),
            vm.uiState.value.exercises.single().sets.map { it.toPlan() },
        )
    }
}
