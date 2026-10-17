package com.nickghignatti.tracker.domain.model

import com.nickghignatti.tracker.domain.fake.FakeProfileRepository
import com.nickghignatti.tracker.domain.fake.FakeWeightRepository
import com.nickghignatti.tracker.domain.usecase.ObserveDailyTargetsUseCase
import java.time.LocalDate
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NutritionTargetsTest {

    private val today = LocalDate.of(2026, 10, 3)
    private val profile = Profile(
        sex = Sex.MALE,
        birthDate = LocalDate.of(1996, 10, 3),
        heightCm = 180.0,
        activity = ActivityLevel.MODERATE,
    )

    @Test
    fun `resting burn follows Mifflin-St Jeor`() {
        // 10 × 80 + 6.25 × 180 − 5 × 30 + 5 = 1780
        assertEquals(1_780.0, NutritionTargets.restingKcal(Sex.MALE, 80.0, 180.0, 30), 0.001)
        // 10 × 60 + 6.25 × 165 − 5 × 30 − 161 = 1320.25
        assertEquals(1_320.25, NutritionTargets.restingKcal(Sex.FEMALE, 60.0, 165.0, 30), 0.001)
    }

    @Test
    fun `maintenance is resting burn times activity, split into macros`() {
        val targets = NutritionTargets.forProfile(profile, weightKg = 80.0, age = 30)!!

        assertEquals(1_780.0 * 1.55, targets.nutrients.kcal, 0.001)
        assertEquals(144.0, targets.nutrients.protein, 0.001) // 1.8 g × 80 kg
        assertEquals(2_759.0 * 0.25 / 9, targets.nutrients.fat, 0.001)
        assertEquals((2_759.0 - 576 - 2_759.0 * 0.25) / 4, targets.nutrients.carbs, 0.001)
        assertFalse(targets.isCustom)
    }

    @Test
    fun `the pace adds or removes energy, but never below the minimum`() {
        val losing = NutritionTargets.forProfile(profile.copy(pace = GoalPace.LOSE), 80.0, 30)!!
        assertEquals(2_759.0 - 550, losing.nutrients.kcal, 0.001) // 0.5 kg × 7700 / 7

        val tiny = Profile(sex = Sex.FEMALE, heightCm = 150.0, activity = ActivityLevel.SEDENTARY, pace = GoalPace.LOSE_FAST)
        assertEquals(NutritionTargets.MIN_KCAL, NutritionTargets.forProfile(tiny, 45.0, 80)!!.nutrients.kcal, 0.0)
    }

    @Test
    fun `a custom target wins, and works without the other data`() {
        val targets = NutritionTargets.forProfile(Profile(customKcal = 2_000.0), weightKg = null, age = null)!!

        assertEquals(2_000.0, targets.nutrients.kcal, 0.0)
        assertEquals(125.0, targets.nutrients.protein, 0.001) // 25% of the calories without a weight
        assertTrue(targets.isCustom)
    }

    @Test
    fun `missing data means no target`() {
        assertNull(NutritionTargets.forProfile(profile, weightKg = null, age = 30))
        assertNull(NutritionTargets.forProfile(profile.copy(heightCm = null), 80.0, 30))
        assertNull(NutritionTargets.forProfile(profile.copy(sex = null), 80.0, 30))
    }

    @Test
    fun `age counts whole years`() {
        assertEquals(30, profile.ageOn(today))
        assertEquals(29, profile.ageOn(today.minusDays(1)))
    }

    @Test
    fun `targets follow the latest weigh-in`() = runTest {
        val profiles = FakeProfileRepository()
        profiles.saveProfile(profile)
        val weights = FakeWeightRepository()
        val observe = ObserveDailyTargetsUseCase(profiles, weights)
        assertNull(observe(today).first())

        weights.logWeight(today.minusDays(7), 82.0)
        weights.logWeight(today, 80.0)
        weights.logWeight(today, 79.5)

        assertEquals(2, weights.entries.size)
        assertEquals(1.8 * 79.5, observe(today).first()!!.nutrients.protein, 0.001)
    }
}
