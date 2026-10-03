package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.fake.FakeTrainingPlanRepository
import com.nickghignatti.tracker.domain.fake.FakeWorkoutRepository
import com.nickghignatti.tracker.domain.fake.ImmediateTransactionRunner
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.model.SetPlan
import java.time.LocalDate
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkoutUseCasesTest {

    private val workouts = FakeWorkoutRepository()
    private val trainingPlans = FakeTrainingPlanRepository()
    private val transaction = ImmediateTransactionRunner()

    private val today = LocalDate.of(2026, 9, 26)
    private val plan = listOf(
        ExercisePlan.uniform("Squat", "", sets = 2, reps = 5, weight = 100.0),
        ExercisePlan("Plank", "seconds", listOf(SetPlan(60, null))),
    )

    @Test
    fun `save as plan stores a daily plan without logged results`() = runTest {
        val workoutId = workouts.createWorkout(today, "Legs", plan)
        val firstSet = workouts.getWorkout(workoutId)!!.exercises[0].sets[0]
        workouts.updateSet(firstSet.copy(done = true, actualReps = 3))

        val planId = SaveWorkoutAsPlanUseCase(workouts, trainingPlans, transaction)(workoutId, "Leg day")

        val saved = trainingPlans.plan(planId!!)
        assertEquals("Leg day", saved.name)
        assertEquals(Recurrence.DAILY, saved.recurrence)
        assertFalse(saved.isActive)
        assertEquals(plan, saved.sessionOn(PlanDay.EveryDay).map { it.toPlan() })
    }

    @Test
    fun `save as plan of a missing workout does nothing`() = runTest {
        assertNull(SaveWorkoutAsPlanUseCase(workouts, trainingPlans, transaction)(workoutId = 42, name = "x"))
        assertTrue(trainingPlans.plans.isEmpty())
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
    fun `logging a completed set with blank actuals keeps the planned values`() = runTest {
        val id = workouts.createWorkout(today, "Legs", plan)
        val set = workouts.getWorkout(id)!!.exercises[0].sets[0]

        LogSetUseCase(workouts)(set.copy(actualReps = 3, actualWeight = null, done = true))

        val stored = workouts.getWorkout(id)!!.exercises[0].sets[0]
        assertEquals(3, stored.actualReps)
        assertEquals(100.0, stored.actualWeight!!, 0.0)
    }

    @Test
    fun `logging a set that is not done stores it as entered`() = runTest {
        val id = workouts.createWorkout(today, "Legs", plan)
        val set = workouts.getWorkout(id)!!.exercises[0].sets[0]

        LogSetUseCase(workouts)(set.copy(plannedReps = 6))

        val stored = workouts.getWorkout(id)!!.exercises[0].sets[0]
        assertEquals(6, stored.plannedReps)
        assertNull(stored.actualReps)
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
