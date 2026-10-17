package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.fake.FakeTrainingPlanRepository
import com.nickghignatti.tracker.domain.fake.FakeWorkoutRepository
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import java.time.DayOfWeek.MONDAY
import java.time.DayOfWeek.SATURDAY
import java.time.DayOfWeek.WEDNESDAY
import java.time.LocalDate
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ObserveTrainingWeekUseCaseTest {

    private val workouts = FakeWorkoutRepository()
    private val trainingPlans = FakeTrainingPlanRepository()
    private val observeWeek = ObserveTrainingWeekUseCase(workouts, trainingPlans)

    // 14 Oct 2026 is a Wednesday; its week runs 12 to 18 October.
    private val wednesday = LocalDate.of(2026, 10, 14)
    private val monday = LocalDate.of(2026, 10, 12)
    private val squat = ExercisePlan.uniform("Squat", "", sets = 2, reps = 5, weight = 100.0)

    private suspend fun activeWeeklyPlan() {
        val id = trainingPlans.createPlan(
            "PPL",
            Recurrence.WEEKLY,
            mapOf(
                PlanDay.Weekday(MONDAY) to listOf(squat),
                PlanDay.Weekday(WEDNESDAY) to listOf(squat),
                PlanDay.Weekday(SATURDAY) to listOf(squat),
            ),
        )
        trainingPlans.setActivePlan(id)
    }

    @Test
    fun `without an active plan there is no week`() = runTest {
        assertNull(observeWeek(wednesday).first())
    }

    @Test
    fun `the week lists the plan's training days`() = runTest {
        activeWeeklyPlan()

        val week = observeWeek(wednesday).first()!!

        assertEquals(listOf(MONDAY, WEDNESDAY, SATURDAY), week.days.map { it.date.dayOfWeek })
        assertEquals(listOf(false, true, false), week.days.map { it.isToday })
        assertTrue(week.hasPendingSessionToday)
    }

    @Test
    fun `a finished workout completes its day and a started one is no longer pending`() = runTest {
        activeWeeklyPlan()
        val mondayWorkout = workouts.createWorkout(monday, "PPL", listOf(squat))
        workouts.getWorkout(mondayWorkout)!!.exercises.flatMap { it.sets }.forEach { workouts.updateSet(it.markedDone()) }
        workouts.createWorkout(wednesday, "PPL", listOf(squat), planId = trainingPlans.getActivePlan()!!.id)

        val week = observeWeek(wednesday).first()!!

        assertEquals(1, week.completedCount)
        assertTrue(week.days.first().isCompleted)
        assertFalse(week.hasPendingSessionToday)
    }
}
