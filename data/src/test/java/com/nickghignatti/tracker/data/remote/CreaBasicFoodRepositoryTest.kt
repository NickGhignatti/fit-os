package com.nickghignatti.tracker.data.remote

import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** Runs against the real bundled CREA table, so it also guards the asset itself. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class CreaBasicFoodRepositoryTest {

    private val repository = CreaBasicFoodRepository(ApplicationProvider.getApplicationContext())

    @Test
    fun `the bundled table has hundreds of foods with energy values`() = runTest {
        val pasta = repository.search("pasta")

        assertTrue("found ${pasta.size} pasta foods", pasta.isNotEmpty())
        assertTrue(pasta.all { it.per100g.kcal > 0 })
    }

    @Test
    fun `everyday Italian searches find something`() = runTest {
        for (query in listOf("mela", "pane", "latte", "uovo", "parmigiano", "pomodoro", "riso", "petto di pollo")) {
            assertTrue("nothing for \"$query\"", repository.search(query).isNotEmpty())
        }
    }
}
