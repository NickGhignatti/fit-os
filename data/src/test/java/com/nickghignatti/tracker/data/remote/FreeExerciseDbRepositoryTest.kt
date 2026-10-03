package com.nickghignatti.tracker.data.remote

import androidx.test.core.app.ApplicationProvider
import com.nickghignatti.tracker.data.di.NetworkModule
import com.nickghignatti.tracker.domain.model.Equipment
import com.nickghignatti.tracker.domain.model.ExerciseCategory
import com.nickghignatti.tracker.domain.model.ExerciseFilter
import com.nickghignatti.tracker.domain.model.Muscle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** Runs against the real bundled catalogue, so it also guards the asset itself. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class FreeExerciseDbRepositoryTest {

    private val repository = FreeExerciseDbRepository(ApplicationProvider.getApplicationContext(), NetworkModule.provideJson())

    @Test
    fun `the whole catalogue loads, with every value understood`() = runTest {
        val all = repository.search("")

        assertEquals(876, all.size)
        assertTrue(all.all { it.primaryMuscles.isNotEmpty() })
        assertTrue(all.count { it.imageUrls.isNotEmpty() } > 850)
    }

    @Test
    fun `common gym exercises are found by name and filtered by muscle and equipment`() = runTest {
        for (query in listOf("squat", "bench press", "deadlift", "pulldown", "leg press", "curl", "plank")) {
            assertTrue("nothing for \"$query\"", repository.search(query).isNotEmpty())
        }

        val chestDumbbell = repository.search("press", ExerciseFilter(Muscle.CHEST, Equipment.DUMBBELL))
        assertTrue(chestDumbbell.isNotEmpty())
        assertTrue(chestDumbbell.all { Muscle.CHEST in it.primaryMuscles && it.equipment == Equipment.DUMBBELL })
    }

    @Test
    fun `an exercise has its details and photo urls`() = runTest {
        val squat = repository.get("Barbell_Squat")!!

        assertEquals("Barbell Squat", squat.name)
        assertEquals(ExerciseCategory.STRENGTH, squat.category)
        assertEquals(Equipment.BARBELL, squat.equipment)
        assertTrue(Muscle.QUADRICEPS in squat.primaryMuscles)
        assertTrue(squat.instructions.isNotEmpty())
        assertTrue(squat.imageUrls.first().startsWith("https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@"))
        assertTrue(squat.imageUrls.first().endsWith("Barbell_Squat/0.jpg"))
    }
}
