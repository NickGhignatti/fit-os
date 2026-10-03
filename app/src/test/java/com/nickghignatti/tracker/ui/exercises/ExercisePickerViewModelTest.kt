package com.nickghignatti.tracker.ui.exercises

import com.nickghignatti.tracker.MainDispatcherRule
import com.nickghignatti.tracker.domain.fake.FakeExerciseCatalogRepository
import com.nickghignatti.tracker.domain.fake.FakeTrainingPlanRepository
import com.nickghignatti.tracker.domain.fake.FakeWorkoutRepository
import com.nickghignatti.tracker.domain.fake.catalogExercise
import com.nickghignatti.tracker.domain.model.Equipment
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.Muscle
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import java.time.DayOfWeek.MONDAY
import java.time.LocalDate
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ExercisePickerViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val benchPress = catalogExercise("Barbell_Bench_Press", "Barbell Bench Press", Muscle.CHEST, Equipment.BARBELL)
    private val dumbbellPress = catalogExercise("Dumbbell_Bench_Press", "Dumbbell Bench Press", Muscle.CHEST, Equipment.DUMBBELL)
    private val squat = catalogExercise("Barbell_Squat", "Barbell Squat", Muscle.QUADRICEPS, Equipment.BARBELL)

    private val catalog = FakeExerciseCatalogRepository(listOf(benchPress, dumbbellPress, squat))
    private val workouts = FakeWorkoutRepository()
    private val plans = FakeTrainingPlanRepository()

    private fun TestScope.viewModel(target: ExerciseTarget) =
        ExercisePickerViewModel(target, catalog, workouts, plans).also { vm ->
            backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.uiState.collect {} }
        }

    @Test
    fun `lists everything, then narrows by text, muscle and equipment`() = runTest {
        val vm = viewModel(ExerciseTarget.Workout(1))
        assertEquals(3, vm.uiState.value.results.size)

        vm.onAction(ExercisePickerAction.QueryChanged("bench"))
        assertEquals(listOf(benchPress, dumbbellPress), vm.uiState.value.results)

        vm.onAction(ExercisePickerAction.QueryChanged(""))
        vm.onAction(ExercisePickerAction.ToggleMuscle(Muscle.CHEST))
        vm.onAction(ExercisePickerAction.ToggleEquipment(Equipment.DUMBBELL))
        assertEquals(listOf(dumbbellPress), vm.uiState.value.results)

        vm.onAction(ExercisePickerAction.ToggleEquipment(Equipment.DUMBBELL))
        assertNull("picking the selected value again clears it", vm.uiState.value.filter.equipment)
        assertEquals(listOf(benchPress, dumbbellPress), vm.uiState.value.results)
    }

    @Test
    fun `a catalogue exercise is added to the workout linked to the catalogue`() = runTest {
        val workoutId = workouts.createWorkout(LocalDate.of(2026, 10, 3), "Push")
        val vm = viewModel(ExerciseTarget.Workout(workoutId))

        vm.onAction(ExercisePickerAction.Pick(benchPress))
        vm.onAction(ExercisePickerAction.Add(ExercisePlan.uniform(" Barbell Bench Press ", "", 3, 8, 60.0, benchPress.id)))

        assertEquals(ExercisePickerEvent.Added, vm.events.first())
        val exercise = workouts.getWorkout(workoutId)!!.exercises.single()
        assertEquals("Barbell Bench Press", exercise.name)
        assertEquals(benchPress.id, exercise.catalogId)
        assertEquals(3, exercise.sets.size)
        assertNull(vm.uiState.value.picked)
    }

    @Test
    fun `custom exercises go to the plan's day without a link`() = runTest {
        val planId = plans.createPlan("Split", Recurrence.WEEKLY)
        val monday = PlanDay.Weekday(MONDAY)
        val vm = viewModel(ExerciseTarget.Plan(planId, monday))

        vm.onAction(ExercisePickerAction.Add(ExercisePlan.uniform("Farmer walk", " 30 m ", 3, 1, 40.0)))

        val exercise = plans.plan(planId).sessionOn(monday).single()
        assertEquals("Farmer walk", exercise.name)
        assertEquals("30 m", exercise.notes)
        assertNull(exercise.catalogId)
    }
}
