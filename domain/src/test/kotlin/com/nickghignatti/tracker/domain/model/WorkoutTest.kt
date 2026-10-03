package com.nickghignatti.tracker.domain.model

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkoutTest {

    private val bench = Exercise(
        id = 1,
        name = "Bench",
        notes = "pause reps",
        sets = listOf(
            ExerciseSet(id = 10, plannedReps = 10, plannedWeight = 60.0, actualReps = 9, actualWeight = 60.0, done = true),
            ExerciseSet(id = 11, plannedReps = 8, plannedWeight = 62.5),
        ),
    )
    private val dips = Exercise(id = 2, name = "Dips", notes = "", sets = listOf(ExerciseSet(id = 20, plannedReps = 12, plannedWeight = null)))
    private val workout = Workout(id = 1, date = LocalDate.of(2026, 9, 26), title = "Push", exercises = listOf(bench, dips))

    @Test
    fun `totals count all and completed sets`() {
        assertEquals(3, workout.totalSets)
        assertEquals(1, workout.doneSets)
    }

    @Test
    fun `plan keeps order and drops logged values`() {
        assertEquals(
            listOf(
                ExercisePlan("Bench", "pause reps", listOf(SetPlan(10, 60.0), SetPlan(8, 62.5))),
                ExercisePlan("Dips", "", listOf(SetPlan(12, null))),
            ),
            workout.toPlan(),
        )
    }

    @Test
    fun `marking done prefills actuals from the plan`() {
        val toggled = ExerciseSet(id = 1, plannedReps = 10, plannedWeight = 60.0).toggledDone()

        assertTrue(toggled.done)
        assertEquals(10, toggled.actualReps)
        assertEquals(60.0, toggled.actualWeight!!, 0.0)
        assertFalse(toggled.deviatesFromPlan)
    }

    @Test
    fun `marking done keeps actuals that were already edited`() {
        val toggled = ExerciseSet(id = 1, plannedReps = 10, plannedWeight = 60.0, actualReps = 7).toggledDone()

        assertEquals(7, toggled.actualReps)
        assertTrue(toggled.deviatesFromPlan)
    }

    @Test
    fun `marked done fills only the missing actual values from the plan`() {
        val logged = ExerciseSet(id = 1, plannedReps = 8, plannedWeight = 62.5, actualReps = 6).markedDone()

        assertTrue(logged.done)
        assertEquals(6, logged.actualReps)
        assertEquals(62.5, logged.actualWeight!!, 0.0)
    }

    @Test
    fun `unmarking keeps actual values`() {
        val undone = ExerciseSet(id = 1, plannedReps = 10, plannedWeight = 60.0).toggledDone().toggledDone()

        assertFalse(undone.done)
        assertEquals(10, undone.actualReps)
        assertFalse(undone.deviatesFromPlan)
    }

    @Test
    fun `day is completed only when every set is done`() {
        val date = LocalDate.of(2026, 9, 26)

        assertTrue(DaySummary(date, totalSets = 3, doneSets = 3).isCompleted)
        assertFalse(DaySummary(date, totalSets = 3, doneSets = 2).isCompleted)
        assertFalse(DaySummary(date, totalSets = 0, doneSets = 0).isCompleted)
    }

    @Test
    fun `uniform plan repeats the same set`() {
        assertEquals(
            ExercisePlan("Squat", "", List(3) { SetPlan(5, 100.0) }),
            ExercisePlan.uniform("Squat", "", sets = 3, reps = 5, weight = 100.0),
        )
    }

    @Test(expected = IllegalArgumentException::class)
    fun `set plan rejects non-positive reps`() {
        SetPlan(0, null)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `set plan rejects negative weight`() {
        SetPlan(5, -1.0)
    }
}
