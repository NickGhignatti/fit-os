package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.fake.FakeTemplateRepository
import com.nickghignatti.tracker.domain.fake.FakeWorkoutRepository
import com.nickghignatti.tracker.domain.fake.ImmediateTransactionRunner
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.SetPlan
import java.time.LocalDate
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkoutUseCasesTest {

    private val workouts = FakeWorkoutRepository()
    private val templates = FakeTemplateRepository()
    private val transaction = ImmediateTransactionRunner()

    private val today = LocalDate.of(2026, 9, 26)
    private val plan = listOf(
        ExercisePlan.uniform("Squat", "", sets = 2, reps = 5, weight = 100.0),
        ExercisePlan("Plank", "seconds", listOf(SetPlan(60, null))),
    )

    @Test
    fun `save as template stores the plan without logged results`() = runTest {
        val workoutId = workouts.createWorkout(today, "Legs", plan)
        val firstSet = workouts.getWorkout(workoutId)!!.exercises[0].sets[0]
        workouts.updateSet(firstSet.copy(done = true, actualReps = 3))

        val templateId = SaveWorkoutAsTemplateUseCase(workouts, templates, transaction)(workoutId, "Leg day")

        val template = templates.getTemplate(templateId!!)!!
        assertEquals("Leg day", template.name)
        assertEquals(plan, template.exercises)
    }

    @Test
    fun `save as template of a missing workout does nothing`() = runTest {
        assertNull(SaveWorkoutAsTemplateUseCase(workouts, templates, transaction)(workoutId = 42, name = "x"))
        assertTrue(templates.templates.isEmpty())
    }

    @Test
    fun `apply template creates a workout on the chosen day`() = runTest {
        val templateId = templates.createTemplate("Leg day", plan)
        val nextWeek = today.plusWeeks(1)

        val workoutId = ApplyTemplateUseCase(templates, workouts, transaction)(templateId, nextWeek)

        val workout = workouts.getWorkout(workoutId!!)!!
        assertEquals(nextWeek, workout.date)
        assertEquals("Leg day", workout.title)
        assertEquals(plan, workout.toPlan())
    }

    @Test
    fun `apply missing template does nothing`() = runTest {
        assertNull(ApplyTemplateUseCase(templates, workouts, transaction)(templateId = 42, date = today))
        assertTrue(workouts.workouts.isEmpty())
    }

    @Test
    fun `copy workout duplicates the plan to another day`() = runTest {
        val sourceId = workouts.createWorkout(today, "Legs", plan)
        val set = workouts.getWorkout(sourceId)!!.exercises[0].sets[0]
        ToggleSetDoneUseCase(workouts)(set)

        val copyId = CopyWorkoutUseCase(workouts, transaction)(sourceId, today.plusDays(2))

        val copy = workouts.getWorkout(copyId!!)!!
        assertEquals(today.plusDays(2), copy.date)
        assertEquals("Legs", copy.title)
        assertEquals(plan, copy.toPlan())
        assertEquals(0, copy.doneSets)
    }

    @Test
    fun `toggle set done persists the prefilled set`() = runTest {
        val id = workouts.createWorkout(today, "Legs", plan)
        val set = workouts.getWorkout(id)!!.exercises[0].sets[0]

        ToggleSetDoneUseCase(workouts)(set)

        val stored = workouts.getWorkout(id)!!.exercises[0].sets[0]
        assertTrue(stored.done)
        assertEquals(5, stored.actualReps)
    }

    @Test
    fun `add set repeats the last set`() = runTest {
        val id = workouts.createWorkout(today, "Legs", plan)
        val squat = workouts.getWorkout(id)!!.exercises[0]

        AddSetUseCase(workouts)(squat)

        val sets = workouts.getWorkout(id)!!.exercises[0].sets
        assertEquals(3, sets.size)
        assertEquals(SetPlan(5, 100.0), sets.last().toPlan())
    }

    @Test
    fun `add set to an empty exercise uses a default`() = runTest {
        val id = workouts.createWorkout(today, "Legs", listOf(ExercisePlan("Lunges", "", emptyList())))
        val lunges = workouts.getWorkout(id)!!.exercises[0]

        AddSetUseCase(workouts)(lunges)

        assertEquals(SetPlan(10, null), workouts.getWorkout(id)!!.exercises[0].sets.single().toPlan())
    }
}
