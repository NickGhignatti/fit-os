package com.nickghignatti.tracker.data.repository

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.nickghignatti.tracker.data.local.AppDatabase
import com.nickghignatti.tracker.domain.model.ActivityLevel
import com.nickghignatti.tracker.domain.model.GoalPace
import com.nickghignatti.tracker.domain.model.Profile
import com.nickghignatti.tracker.domain.model.Sex
import java.time.LocalDate
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class RoomProfileRepositoriesTest {

    private lateinit var db: AppDatabase

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AppDatabase::class.java)
            .allowMainThreadQueries()
            .build()
    }

    @After
    fun tearDown() = db.close()

    @Test
    fun `the profile is empty until saved, then round-trips`() = runTest {
        val profiles = RoomProfileRepository(db)
        assertEquals(Profile(), profiles.observeProfile().first())

        val saved = Profile("Nick", Sex.MALE, LocalDate.of(1996, 5, 1), 180.0, ActivityLevel.ACTIVE, GoalPace.LOSE_SLOW, 2_300.0)
        profiles.saveProfile(saved)
        profiles.saveProfile(saved.copy(heightCm = 181.0))

        assertEquals(saved.copy(heightCm = 181.0), profiles.observeProfile().first())
    }

    @Test
    fun `weigh-ins are sorted by date and one per day`() = runTest {
        val weights = RoomWeightRepository(db)
        val today = LocalDate.of(2026, 10, 3)

        weights.logWeight(today, 80.0)
        weights.logWeight(today.minusDays(7), 81.2)
        weights.logWeight(today, 79.6)

        val entries = weights.observeEntries().first()
        assertEquals(listOf(today.minusDays(7) to 81.2, today to 79.6), entries.map { it.date to it.kg })

        weights.deleteEntry(entries.first().id)
        assertEquals(1, weights.observeEntries().first().size)
    }
}
