package com.nickghignatti.tracker.domain.model

import java.time.LocalDate
import java.time.Period

/** What the app knows about the user, to work out a daily goal. Everything is optional until set. */
data class Profile(
    val name: String = "",
    val sex: Sex? = null,
    val birthDate: LocalDate? = null,
    val heightCm: Double? = null,
    val activity: ActivityLevel = ActivityLevel.MODERATE,
    val pace: GoalPace = GoalPace.MAINTAIN,
    /** A calorie target the user chose themselves; replaces the computed one when set. */
    val customKcal: Double? = null,
) {
    fun ageOn(date: LocalDate): Int? = birthDate?.let { Period.between(it, date).years }
}

enum class Sex { MALE, FEMALE }

/** Multipliers of the resting burn for daily activity, training included (the usual Harris–Benedict factors). */
enum class ActivityLevel(val factor: Double) {
    SEDENTARY(1.2),
    LIGHT(1.375),
    MODERATE(1.55),
    ACTIVE(1.725),
    VERY_ACTIVE(1.9),
}

/** How fast to change weight, in kg per week; negative loses. */
enum class GoalPace(val kgPerWeek: Double) {
    LOSE_FAST(-0.75),
    LOSE(-0.5),
    LOSE_SLOW(-0.25),
    MAINTAIN(0.0),
    GAIN_SLOW(0.25),
    GAIN(0.5),
}

/** One weigh-in; there is at most one per day. */
data class WeightEntry(
    val id: Long,
    val date: LocalDate,
    val kg: Double,
)

/** What to eat in a day. */
data class DailyTargets(
    val nutrients: Nutrients,
    /** True when the calories are the user's own number rather than computed. */
    val isCustom: Boolean,
)
