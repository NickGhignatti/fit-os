package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.fake.FakeDietPlanRepository
import com.nickghignatti.tracker.domain.fake.FakeTrainingPlanRepository
import com.nickghignatti.tracker.domain.fake.FakeWorkoutRepository
import com.nickghignatti.tracker.domain.fake.ImmediateTransactionRunner
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.PendingSession
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.model.SetPlan
import java.time.DayOfWeek.MONDAY
import java.time.DayOfWeek.SATURDAY
import java.time.LocalDate
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PlannedSessionUseCasesTest {

    private val workouts = FakeWorkoutRepository()
    private val trainingPlans = FakeTrainingPlanRepository()
    private val dietPlans = FakeDietPlanRepository()
    private val observeAgenda = ObserveDayAgendaUseCase(workouts, trainingPlans, dietPlans)
    private val startSession = StartPlannedSessionUseCase(workouts, trainingPlans, ImmediateTransactionRunner())

    // 26 Sep 2026 is a Saturday.
    private val saturday = LocalDate.of(2026, 9, 26)
    private val squat = ExercisePlan.uniform("Squat", "", sets = 3, reps = 5, weight = 100.0)

    private suspend fun activeWeeklyPlan(): Long {
        val id = trainingPlans.createPlan("PPL", Recurrence.WEEKLY, mapOf(PlanDay.Weekday(SATURDAY) to listOf(squat)))
        trainingPlans.setActivePlan(id)
        return id
    }

    @Test
    fun `agenda shows the active plan's session for the day as pending`() = runTest {
        val planId = activeWeeklyPlan()

        val agenda = observeAgenda(saturday).first()

        assertEquals(PendingSession(planId, "PPL", listOf(squat)), agenda.pendingSession)
        assertTrue(agenda.hasTrainingPlan)
        assertTrue(agenda.workouts.isEmpty())
    }

    @Test
    fun `a weekly plan's rest day has no pending session`() = runTest {
        activeWeeklyPlan()

        assertNull(observeAgenda(saturday.plusDays(2)).first().pendingSession)
    }

    @Test
    fun `a daily plan applies to every day`() = runTest {
        val id = trainingPlans.createPlan("Mobility", Recurrence.DAILY, mapOf(PlanDay.EveryDay to listOf(squat)))
        trainingPlans.setActivePlan(id)

        for (offset in 0L..6L) {
            assertEquals("Mobility", observeAgenda(saturday.plusDays(offset)).first().pendingSession?.title)
        }
    }

    @Test
    fun `inactive plans are ignored`() = runTest {
        trainingPlans.createPlan("PPL", Recurrence.DAILY, mapOf(PlanDay.EveryDay to listOf(squat)))

        val agenda = observeAgenda(saturday).first()

        assertNull(agenda.pendingSession)
        assertFalse(agenda.hasTrainingPlan)
    }

    @Test
    fun `agenda lists the active diet plan's meals for the weekday`() = runTest {
        val diet = dietPlans.createPlan("Cut", Recurrence.WEEKLY)
        dietPlans.addMeal(diet, PlanDay.Weekday(SATURDAY), "Pizza", "")
        dietPlans.addMeal(diet, PlanDay.Weekday(MONDAY), "Oats", "")
        dietPlans.setActivePlan(diet)

        val agenda = observeAgenda(saturday).first()

        assertEquals(listOf("Pizza"), agenda.meals.map { it.name })
        assertTrue(agenda.hasDietPlan)
    }

    @Test
    fun `starting creates the workout from the plan, and it is no longer pending`() = runTest {
        val planId = activeWeeklyPlan()

        val workoutId = startSession(saturday)

        val workout = workouts.getWorkout(workoutId!!)!!
        assertEquals(saturday, workout.date)
        assertEquals("PPL", workout.title)
        assertEquals(planId, workout.planId)
        assertEquals(listOf(squat), workout.toPlan())
        assertNull(observeAgenda(saturday).first().pendingSession)
    }

    @Test
    fun `starting twice returns the same workout`() = runTest {
        activeWeeklyPlan()

        val first = startSession(saturday)
        val second = startSession(saturday)

        assertEquals(first, second)
        assertEquals(1, workouts.workouts.size)
    }

    @Test
    fun `other workouts on the day do not hide the pending session`() = runTest {
        activeWeeklyPlan()
        workouts.createWorkout(saturday, "Extra run", listOf(ExercisePlan("Run", "", listOf(SetPlan(1, null)))))

        val agenda = observeAgenda(saturday).first()

        assertEquals("PPL", agenda.pendingSession?.title)
        assertEquals(listOf("Extra run"), agenda.workouts.map { it.title })
    }

    @Test
    fun `nothing to start without an active plan or on a rest day`() = runTest {
        assertNull(startSession(saturday))

        activeWeeklyPlan()
        assertNull(startSession(saturday.plusDays(2)))
        assertTrue(workouts.workouts.isEmpty())
    }

    @Test
    fun `switching plan makes the new plan's session pending`() = runTest {
        activeWeeklyPlan()
        startSession(saturday)
        val other = trainingPlans.createPlan("Full body", Recurrence.DAILY, mapOf(PlanDay.EveryDay to listOf(squat)))

        trainingPlans.setActivePlan(other)

        assertEquals("Full body", observeAgenda(saturday).first().pendingSession?.title)
    }
}
