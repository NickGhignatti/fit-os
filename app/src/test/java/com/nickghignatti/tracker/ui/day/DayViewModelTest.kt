package com.nickghignatti.tracker.ui.day

import com.nickghignatti.tracker.MainDispatcherRule
import com.nickghignatti.tracker.domain.fake.FakeTemplateRepository
import com.nickghignatti.tracker.domain.fake.FakeWorkoutRepository
import com.nickghignatti.tracker.domain.fake.ImmediateTransactionRunner
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.usecase.AddSetUseCase
import com.nickghignatti.tracker.domain.usecase.ApplyTemplateUseCase
import com.nickghignatti.tracker.domain.usecase.CopyWorkoutUseCase
import com.nickghignatti.tracker.domain.usecase.SaveWorkoutAsTemplateUseCase
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
    private val templates = FakeTemplateRepository()
    private val transaction = ImmediateTransactionRunner()
    private val squat = ExercisePlan.uniform("Squat", "", sets = 3, reps = 5, weight = 100.0)

    private fun viewModel(date: LocalDate = today) = DayViewModel(
        date = date,
        clock = clock,
        workouts = workouts,
        templates = templates,
        saveWorkoutAsTemplate = SaveWorkoutAsTemplateUseCase(workouts, templates, transaction),
        applyTemplate = ApplyTemplateUseCase(templates, workouts, transaction),
        copyWorkout = CopyWorkoutUseCase(workouts, transaction),
        toggleSetDone = ToggleSetDoneUseCase(workouts),
        addSet = AddSetUseCase(workouts),
    )

    @Test
    fun `state holds only this day's workouts plus all templates`() = runTest {
        workouts.createWorkout(today, "Legs")
        workouts.createWorkout(today.plusDays(1), "Tomorrow")
        templates.createTemplate("Push", emptyList())
        val vm = viewModel()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.uiState.collect {} }

        val state = vm.uiState.value
        assertFalse(state.isLoading)
        assertTrue(state.isToday)
        assertEquals(listOf("Legs"), state.workouts.map { it.title })
        assertEquals(listOf("Push"), state.templates.map { it.name })
    }

    @Test
    fun `another day is not today`() {
        assertFalse(viewModel(today.plusDays(3)).uiState.value.isToday)
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
    fun `saving as template confirms with the trimmed name`() = runTest {
        val id = workouts.createWorkout(today, "Legs", listOf(squat))
        val vm = viewModel()

        vm.onAction(DayAction.SaveAsTemplate(id, " Leg day "))

        assertEquals(DayEvent.TemplateSaved("Leg day"), vm.events.first())
        assertEquals(listOf(squat), templates.templates.single().exercises)
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

    @Test
    fun `applying a template creates a workout on this day`() = runTest {
        val templateId = templates.createTemplate("Leg day", listOf(squat))
        val date = today.plusDays(2)

        viewModel(date).onAction(DayAction.ApplyTemplate(templateId))

        val workout = workouts.workouts.single()
        assertEquals(date, workout.date)
        assertEquals("Leg day", workout.title)
    }
}
