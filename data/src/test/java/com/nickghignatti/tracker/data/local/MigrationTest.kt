package com.nickghignatti.tracker.data.local

import androidx.room.Room
import androidx.room.testing.MigrationTestHelper
import androidx.test.core.app.ApplicationProvider
import androidx.test.platform.app.InstrumentationRegistry
import com.nickghignatti.tracker.data.repository.RoomDietPlanRepository
import com.nickghignatti.tracker.data.repository.RoomTrainingPlanRepository
import com.nickghignatti.tracker.data.repository.RoomWorkoutRepository
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.PlannedExercise
import com.nickghignatti.tracker.domain.model.PlannedSet
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.model.TrainingPlan
import java.time.DayOfWeek.MONDAY
import java.time.DayOfWeek.TUESDAY
import java.time.LocalDate
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class MigrationTest {

    @get:Rule
    val helper = MigrationTestHelper(InstrumentationRegistry.getInstrumentation(), AppDatabase::class.java)

    private var migrated: AppDatabase? = null

    @After
    fun tearDown() {
        migrated?.close()
    }

    @Test
    fun `1 to 2 keeps workouts, turns templates into daily plans and meals into the active diet`() = runTest {
        helper.createDatabase(DB_NAME, 1).use { db ->
            db.execSQL("INSERT INTO workouts (id, date, title) VALUES (1, ${LocalDate.of(2026, 9, 26).toEpochDay()}, 'Legs')")
            db.execSQL("INSERT INTO templates (id, name) VALUES (3, 'Leg day')")
            db.execSQL("INSERT INTO template_exercises (id, templateId, position, name, notes) VALUES (5, 3, 0, 'Squat', 'belt')")
            db.execSQL("INSERT INTO template_sets (id, templateExerciseId, position, reps, weight) VALUES (7, 5, 0, 5, 100.0)")
            db.execSQL("INSERT INTO template_sets (id, templateExerciseId, position, reps, weight) VALUES (8, 5, 1, 12, NULL)")
            db.execSQL("INSERT INTO meals (id, dayOfWeek, position, name, time) VALUES (1, 1, 0, 'Breakfast', '08:00')")
            db.execSQL("INSERT INTO meals (id, dayOfWeek, position, name, time) VALUES (2, 2, 0, 'Lunch', '')")
            db.execSQL("INSERT INTO foods (id, mealId, position, name, quantity) VALUES (1, 1, 0, 'Oats', '80 g')")
        }

        helper.runMigrationsAndValidate(DB_NAME, 2, true, Migration1To2).close()
        val db = openMigrated()

        val trainingPlan = RoomTrainingPlanRepository(db).observePlans().first().single()
        val squat = PlannedExercise(5, "Squat", "belt", listOf(PlannedSet(7, 5, 100.0), PlannedSet(8, 12, null)))
        assertEquals(TrainingPlan(3, "Leg day", Recurrence.DAILY, isActive = false, mapOf(PlanDay.EveryDay to listOf(squat))), trainingPlan)

        val diet = RoomDietPlanRepository(db).getActivePlan()!!
        assertEquals(Recurrence.WEEKLY, diet.recurrence)
        assertEquals(listOf("Breakfast"), diet.mealsOn(PlanDay.Weekday(MONDAY)).map { it.name })
        assertEquals(listOf("Oats"), diet.mealsOn(PlanDay.Weekday(MONDAY)).single().foods.map { it.name })
        assertEquals(listOf("Lunch"), diet.mealsOn(PlanDay.Weekday(TUESDAY)).map { it.name })

        val workout = RoomWorkoutRepository(db).getWorkout(1)!!
        assertEquals("Legs", workout.title)
        assertNull(workout.planId)
    }

    @Test
    fun `1 to 2 without meals creates no diet plan`() = runTest {
        helper.createDatabase(DB_NAME, 1).close()

        helper.runMigrationsAndValidate(DB_NAME, 2, true, Migration1To2).close()

        assertTrue(RoomDietPlanRepository(openMigrated()).observePlans().first().isEmpty())
    }

    private fun openMigrated(): AppDatabase =
        Room.databaseBuilder(ApplicationProvider.getApplicationContext(), AppDatabase::class.java, DB_NAME)
            .addMigrations(*ALL_MIGRATIONS)
            .allowMainThreadQueries()
            .build()
            .also { migrated = it }

    private companion object {
        const val DB_NAME = "migration-test.db"
    }
}
