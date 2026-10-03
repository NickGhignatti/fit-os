package com.nickghignatti.tracker.ui.day

import com.nickghignatti.tracker.MainDispatcherRule
import com.nickghignatti.tracker.domain.fake.FakeDietPlanRepository
import com.nickghignatti.tracker.domain.fake.FakeTrainingPlanRepository
import com.nickghignatti.tracker.domain.fake.FakeWorkoutRepository
import com.nickghignatti.tracker.domain.fake.ImmediateTransactionRunner
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.usecase.AddSetUseCase
import com.nickghignatti.tracker.domain.usecase.CopyWorkoutUseCase
import com.nickghignatti.tracker.domain.usecase.LogSetUseCase
import com.nickghignatti.tracker.domain.usecase.ObserveDayAgendaUseCase
import com.nickghignatti.tracker.domain.usecase.SaveWorkoutAsPlanUseCase
import com.nickghignatti.tracker.domain.usecase.StartPlannedSessionUseCase
import com.nickghignatti.tracker.domain.usecase.ToggleSetDoneUseCase
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DayViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val today = LocalDate.of(2026, 9, 26)
    private val clock = Clock.fixed(today.atStartOfDay().toInstant(ZoneOffset.UTC), ZoneOffset.UTC)
    private val workouts = FakeWorkoutRepository()
    private val trainingPlans = FakeTrainingPlanRepository()
    private val transaction = ImmediateTransactionRunner()
    private val squat = ExercisePlan.uniform("Squat", "", sets = 3, reps = 5, weight = 100.0)

    private fun viewModel(date: LocalDate = today) = DayViewModel(
        date = date,
        clock = clock,
        workouts = workouts,
        observeDayAgenda = ObserveDayAgendaUseCase(workouts, trainingPlans, FakeDietPlanRepository()),
        startPlannedSession = StartPlannedSessionUseCase(workouts, trainingPlans, transaction),
        saveWorkoutAsPlan = SaveWorkoutAsPlanUseCase(workouts, trainingPlans, transaction),
        copyWorkout = CopyWorkoutUseCase(workouts, transaction),
        toggleSetDone = ToggleSetDoneUseCase(workouts),
        addSet = AddSetUseCase(workouts),
        logSet = LogSetUseCase(workouts),
    )

    @Test
    fun `state holds only this day's workouts`() = runTest {
        workouts.createWorkout(today, "Legs")
        workouts.createWorkout(today.plusDays(1), "Tomorrow")
        val vm = viewModel()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.uiState.collect {} }

        val state = vm.uiState.value
        assertFalse(state.isLoading)
        assertTrue(state.isToday)
        assertEquals(listOf("Legs"), state.workouts.map { it.title })
        assertNull(state.pendingSession)
    }

    @Test
    fun `another day is not today`() {
        assertFalse(viewModel(today.plusDays(3)).uiState.value.isToday)
    }

    @Test
    fun `the active plan's session can be started from the day`() = runTest {
        val planId = trainingPlans.createPlan("Full body", Recurrence.DAILY, mapOf(PlanDay.EveryDay to listOf(squat)))
        trainingPlans.setActivePlan(planId)
        val vm = viewModel()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.uiState.collect {} }
        assertEquals("Full body", vm.uiState.value.pendingSession?.title)

        vm.onAction(DayAction.StartPlannedSession)

        assertNull(vm.uiState.value.pendingSession)
        assertEquals(listOf(squat), vm.uiState.value.workouts.single().toPlan())
    }

    @Test
    fun `create workout trims its title`() {
        viewModel().onAction(DayAction.CreateWorkout("  Push  "))

        assertEquals("Push", workouts.workouts.single().title)
    }

    @Test
    fun `toggling a set marks it done`() = runTest {
        val id = workouts.createWorkout(today, "Legs", listOf(squat))
        val set = workouts.getWorkout(id)!!.exercises[0].sets[0]

        viewModel().onAction(DayAction.ToggleSet(set))

        assertTrue(workouts.getWorkout(id)!!.exercises[0].sets[0].done)
    }

    @Test
    fun `completing a set from its dialog with blank kg keeps the planned weight`() = runTest {
        val id = workouts.createWorkout(today, "Legs", listOf(squat))
        val set = workouts.getWorkout(id)!!.exercises[0].sets[0]

        viewModel().onAction(DayAction.UpdateSet(set.copy(actualReps = 3, done = true)))

        val stored = workouts.getWorkout(id)!!.exercises[0].sets[0]
        assertEquals(3, stored.actualReps)
        assertEquals(100.0, stored.actualWeight!!, 0.0)
    }

    @Test
    fun `saving as a plan confirms with the trimmed name`() = runTest {
        val id = workouts.createWorkout(today, "Legs", listOf(squat))
        val vm = viewModel()

        vm.onAction(DayAction.SaveAsPlan(id, " Leg day "))

        assertEquals(DayEvent.PlanSaved("Leg day"), vm.events.first())
        assertEquals(listOf(squat), trainingPlans.plans.single().sessionOn(PlanDay.EveryDay).map { it.toPlan() })
    }

    @Test
    fun `copying confirms with the target date`() = runTest {
        val id = workouts.createWorkout(today, "Legs", listOf(squat))
        val vm = viewModel()
        val target = today.plusWeeks(1)

        vm.onAction(DayAction.CopyWorkout(id, target))

        assertEquals(DayEvent.WorkoutCopied(target), vm.events.first())
        assertEquals(listOf(today, target), workouts.workouts.map { it.date })
    }
}
