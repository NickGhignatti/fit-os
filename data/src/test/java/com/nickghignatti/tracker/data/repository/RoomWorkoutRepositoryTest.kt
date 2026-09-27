package com.nickghignatti.tracker.data.repository

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.nickghignatti.tracker.data.local.AppDatabase
import com.nickghignatti.tracker.domain.model.DaySummary
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.SetPlan
import java.time.LocalDate
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class RoomWorkoutRepositoryTest {

    private lateinit var db: AppDatabase
    private lateinit var workouts: RoomWorkoutRepository
    private lateinit var templates: RoomTemplateRepository

    private val today = LocalDate.of(2026, 9, 26)
    private val plan = listOf(
        ExercisePlan("Squat", "", listOf(SetPlan(5, 100.0), SetPlan(5, 102.5), SetPlan(3, 105.0))),
        ExercisePlan("Plank", "seconds", listOf(SetPlan(60, null))),
    )

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AppDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        workouts = RoomWorkoutRepository(db)
        templates = RoomTemplateRepository(db)
    }

    @After
    fun tearDown() = db.close()

    @Test
    fun `created workout round-trips with exercises and sets in order`() = runTest {
        val id = workouts.createWorkout(today, "Legs", plan)

        val workout = workouts.observeWorkouts(today).first().single()
        assertEquals(id, workout.id)
        assertEquals("Legs", workout.title)
        assertEquals(plan, workout.toPlan())
    }

    @Test
    fun `added exercises and sets go to the end`() = runTest {
        val id = workouts.createWorkout(today, "Legs", plan)
        workouts.addExercise(id, ExercisePlan("Calf raise", "", listOf(SetPlan(15, 40.0))))
        val squat = workouts.getWorkout(id)!!.exercises.first()
        workouts.addSet(squat.id, SetPlan(1, 110.0))

        val workout = workouts.getWorkout(id)!!
        assertEquals(listOf("Squat", "Plank", "Calf raise"), workout.exercises.map { it.name })
        assertEquals(SetPlan(1, 110.0), workout.exercises.first().sets.last().toPlan())
    }

    @Test
    fun `set updates persist logged values`() = runTest {
        val id = workouts.createWorkout(today, "Legs", plan)
        val set = workouts.getWorkout(id)!!.exercises.first().sets.first()

        workouts.updateSet(set.copy(actualReps = 4, actualWeight = 100.0, done = true))

        val stored = workouts.getWorkout(id)!!.exercises.first().sets.first()
        assertEquals(4, stored.actualReps)
        assertTrue(stored.done)
    }

    @Test
    fun `day summaries aggregate sets per day`() = runTest {
        val id = workouts.createWorkout(today, "Legs", plan)
        workouts.createWorkout(today.plusDays(1), "Rest", emptyList())
        workouts.createWorkout(today.plusMonths(2), "Out of range", plan)
        val set = workouts.getWorkout(id)!!.exercises.first().sets.first()
        workouts.updateSet(set.toggledDone())

        val summaries = workouts.observeDaySummaries(today, today.plusDays(30)).first()

        assertEquals(
            setOf(DaySummary(today, totalSets = 4, doneSets = 1), DaySummary(today.plusDays(1), 0, 0)),
            summaries.toSet(),
        )
    }

    @Test
    fun `deleting a workout cascades to its exercises and sets`() = runTest {
        val id = workouts.createWorkout(today, "Legs", plan)

        workouts.deleteWorkout(id)

        assertNull(workouts.getWorkout(id))
        assertTrue(workouts.observeDaySummaries(today, today).first().isEmpty())
    }

    @Test
    fun `transaction runner rolls back every write on failure`() = runTest {
        val transaction = RoomTransactionRunner(db)

        runCatching {
            transaction.run {
                workouts.createWorkout(today, "Legs", plan)
                templates.createTemplate("Leg day", plan)
                error("boom")
            }
        }

        assertTrue(workouts.observeWorkouts(today).first().isEmpty())
        assertTrue(templates.observeTemplates().first().isEmpty())
    }

    @Test
    fun `templates round-trip in name order`() = runTest {
        templates.createTemplate("push", emptyList())
        val legsId = templates.createTemplate("Legs", plan)

        assertEquals(listOf("Legs", "push"), templates.observeTemplates().first().map { it.name })
        assertEquals(plan, templates.getTemplate(legsId)!!.exercises)
    }
}
