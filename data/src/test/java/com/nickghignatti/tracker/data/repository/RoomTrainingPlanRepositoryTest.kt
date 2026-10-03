package com.nickghignatti.tracker.data.repository

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.nickghignatti.tracker.data.local.AppDatabase
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.model.SetPlan
import java.time.DayOfWeek.FRIDAY
import java.time.DayOfWeek.MONDAY
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
class RoomTrainingPlanRepositoryTest {

    private lateinit var db: AppDatabase
    private lateinit var plans: RoomTrainingPlanRepository

    private val monday = PlanDay.Weekday(MONDAY)
    private val friday = PlanDay.Weekday(FRIDAY)
    private val squat = ExercisePlan("Squat", "", listOf(SetPlan(5, 100.0), SetPlan(3, 105.0)))
    private val plank = ExercisePlan("Plank", "seconds", listOf(SetPlan(60, null)))

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AppDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        plans = RoomTrainingPlanRepository(db)
    }

    @After
    fun tearDown() = db.close()

    @Test
    fun `a weekly plan round-trips its sessions per day, in order`() = runTest {
        val id = plans.createPlan("Split", Recurrence.WEEKLY, mapOf(monday to listOf(squat, plank), friday to listOf(plank)))

        val plan = plans.observePlan(id).first()!!

        assertEquals("Split", plan.name)
        assertEquals(Recurrence.WEEKLY, plan.recurrence)
        assertEquals(listOf(squat, plank), plan.sessionOn(monday).map { it.toPlan() })
        assertEquals(listOf(plank), plan.sessionOn(friday).map { it.toPlan() })
        assertEquals(listOf(monday, friday), plan.trainingDays)
    }

    @Test
    fun `plans are listed by name`() = runTest {
        plans.createPlan("push", Recurrence.DAILY)
        plans.createPlan("Legs", Recurrence.WEEKLY)

        assertEquals(listOf("Legs", "push"), plans.observePlans().first().map { it.name })
    }

    @Test
    fun `exercises and sets are added at the end of their day and edited in place`() = runTest {
        val id = plans.createPlan("Split", Recurrence.WEEKLY, mapOf(monday to listOf(squat)))
        plans.addExercise(id, monday, plank)
        plans.addExercise(id, friday, squat)
        val stored = plans.observePlan(id).first()!!.sessionOn(monday).first()

        plans.addSet(stored.id, SetPlan(1, 110.0))
        plans.updateSet(stored.sets.first().id, SetPlan(6, 95.0))
        plans.updateExercise(stored.id, "Back squat", "belt")
        plans.deleteSet(stored.sets.last().id)

        val monday = plans.observePlan(id).first()!!.sessionOn(monday)
        assertEquals(listOf("Back squat", "Plank"), monday.map { it.name })
        assertEquals("belt", monday.first().notes)
        assertEquals(listOf(SetPlan(6, 95.0), SetPlan(1, 110.0)), monday.first().sets.map { it.toPlan() })
    }

    @Test
    fun `only one plan is active at a time`() = runTest {
        val a = plans.createPlan("A", Recurrence.DAILY)
        val b = plans.createPlan("B", Recurrence.DAILY)

        plans.setActivePlan(a)
        plans.setActivePlan(b)
        assertEquals(b, plans.getActivePlan()?.id)
        assertEquals(listOf(false, true), plans.observePlans().first().map { it.isActive })

        plans.setActivePlan(null)
        assertNull(plans.observeActivePlan().first())
    }

    @Test
    fun `deleting a plan cascades to its exercises and sets`() = runTest {
        val id = plans.createPlan("Split", Recurrence.WEEKLY, mapOf(monday to listOf(squat)))
        val exerciseId = plans.observePlan(id).first()!!.sessionOn(monday).single().id

        plans.deletePlan(id)

        assertNull(plans.observePlan(id).first())
        plans.deleteExercise(exerciseId)
        val orphans = db.query("SELECT (SELECT COUNT(*) FROM plan_exercises) + (SELECT COUNT(*) FROM plan_sets)", null)
            .use { it.moveToFirst(); it.getInt(0) }
        assertEquals(0, orphans)
        assertTrue(plans.observePlans().first().isEmpty())
    }
}
