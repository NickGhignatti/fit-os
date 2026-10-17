package com.nickghignatti.tracker.domain.model

import kotlin.math.max

/**
 * Daily calorie and macro targets from a profile and a body weight.
 *
 * Calories: resting burn by Mifflin–St Jeor, times the activity factor, plus the energy of the
 * chosen pace (about 7,700 kcal per kg), never below [MIN_KCAL]. Macros: protein by body weight,
 * fat as a share of calories, carbs for the rest.
 */
object NutritionTargets {
    const val MIN_KCAL = 1_200.0
    private const val KCAL_PER_KG = 7_700.0
    private const val DAYS_PER_WEEK = 7
    private const val PROTEIN_G_PER_KG = 1.8
    private const val FAT_SHARE = 0.25
    private const val PROTEIN_SHARE_WITHOUT_WEIGHT = 0.25
    private const val KCAL_PER_G_PROTEIN = 4.0
    private const val KCAL_PER_G_CARBS = 4.0
    private const val KCAL_PER_G_FAT = 9.0

    /** Mifflin–St Jeor resting energy expenditure, in kcal per day. */
    fun restingKcal(sex: Sex, weightKg: Double, heightCm: Double, age: Int): Double =
        10 * weightKg + 6.25 * heightCm - 5 * age + if (sex == Sex.MALE) 5 else -161

    /** Null when neither a custom target nor the data to compute one is available. */
    fun forProfile(profile: Profile, weightKg: Double?, age: Int?): DailyTargets? {
        val custom = profile.customKcal
        val kcal = custom ?: computedKcal(profile, weightKg, age) ?: return null
        return DailyTargets(split(kcal, weightKg), isCustom = custom != null)
    }

    private fun computedKcal(profile: Profile, weightKg: Double?, age: Int?): Double? {
        val sex = profile.sex ?: return null
        val height = profile.heightCm ?: return null
        if (weightKg == null || age == null) return null
        val maintenance = restingKcal(sex, weightKg, height, age) * profile.activity.factor
        return max(MIN_KCAL, maintenance + profile.pace.kgPerWeek * KCAL_PER_KG / DAYS_PER_WEEK)
    }

    private fun split(kcal: Double, weightKg: Double?): Nutrients {
        val proteinKcal = weightKg?.let { it * PROTEIN_G_PER_KG * KCAL_PER_G_PROTEIN } ?: (kcal * PROTEIN_SHARE_WITHOUT_WEIGHT)
        val fatKcal = kcal * FAT_SHARE
        val carbsKcal = max(0.0, kcal - proteinKcal - fatKcal)
        return Nutrients(
            kcal = kcal,
            protein = proteinKcal / KCAL_PER_G_PROTEIN,
            carbs = carbsKcal / KCAL_PER_G_CARBS,
            fat = fatKcal / KCAL_PER_G_FAT,
        )
    }
}
