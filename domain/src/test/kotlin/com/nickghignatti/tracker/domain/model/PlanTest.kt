package com.nickghignatti.tracker.domain.model

import java.time.DayOfWeek.MONDAY
import java.time.DayOfWeek.SUNDAY
import java.time.DayOfWeek.WEDNESDAY
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PlanTest {

    private val squat = PlannedExercise(1, "Squat", "", listOf(PlannedSet(2, 5, 100.0)))

    @Test
    fun `a daily plan has one day that applies to every date`() {
        assertEquals(listOf(PlanDay.EveryDay), Recurrence.DAILY.days)
        assertEquals(PlanDay.EveryDay, Recurrence.DAILY.dayOf(LocalDate.of(2026, 9, 28)))
    }

    @Test
    fun `a weekly plan has the seven weekdays, Monday first`() {
        assertEquals(7, Recurrence.WEEKLY.days.size)
        assertEquals(PlanDay.Weekday(MONDAY), Recurrence.WEEKLY.days.first())
        assertEquals(PlanDay.Weekday(SUNDAY), Recurrence.WEEKLY.days.last())
        // 30 Sep 2026 is a Wednesday.
        assertEquals(PlanDay.Weekday(WEDNESDAY), Recurrence.WEEKLY.dayOf(LocalDate.of(2026, 9, 30)))
    }

    @Test
    fun `training days are the days with exercises, in week order`() {
        val plan = TrainingPlan(
            id = 1,
            name = "Split",
            recurrence = Recurrence.WEEKLY,
            sessions = mapOf(
                PlanDay.Weekday(WEDNESDAY) to listOf(squat),
                PlanDay.Weekday(MONDAY) to listOf(squat),
                PlanDay.Weekday(SUNDAY) to emptyList(),
            ),
        )

        assertEquals(listOf(PlanDay.Weekday(MONDAY), PlanDay.Weekday(WEDNESDAY)), plan.trainingDays)
        assertTrue(plan.sessionOn(LocalDate.of(2026, 10, 4)).isEmpty())
    }

    @Test
    fun `one more set repeats the last, or uses a default`() {
        assertEquals(SetPlan(5, 100.0), SetPlan.following(SetPlan(5, 100.0)))
        assertEquals(SetPlan(10, null), SetPlan.following(null))
    }
}
