package com.nickghignatti.tracker.ui.profile

import androidx.annotation.StringRes
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.ActivityLevel
import com.nickghignatti.tracker.domain.model.GoalPace
import com.nickghignatti.tracker.domain.model.Sex

@StringRes
fun Sex.label(): Int = when (this) {
    Sex.MALE -> R.string.sex_male
    Sex.FEMALE -> R.string.sex_female
}

@StringRes
fun ActivityLevel.label(): Int = when (this) {
    ActivityLevel.SEDENTARY -> R.string.activity_sedentary
    ActivityLevel.LIGHT -> R.string.activity_light
    ActivityLevel.MODERATE -> R.string.activity_moderate
    ActivityLevel.ACTIVE -> R.string.activity_active
    ActivityLevel.VERY_ACTIVE -> R.string.activity_very_active
}

@StringRes
fun ActivityLevel.description(): Int = when (this) {
    ActivityLevel.SEDENTARY -> R.string.activity_sedentary_description
    ActivityLevel.LIGHT -> R.string.activity_light_description
    ActivityLevel.MODERATE -> R.string.activity_moderate_description
    ActivityLevel.ACTIVE -> R.string.activity_active_description
    ActivityLevel.VERY_ACTIVE -> R.string.activity_very_active_description
}

@StringRes
fun GoalPace.label(): Int = when (this) {
    GoalPace.LOSE_FAST -> R.string.pace_lose_fast
    GoalPace.LOSE -> R.string.pace_lose
    GoalPace.LOSE_SLOW -> R.string.pace_lose_slow
    GoalPace.MAINTAIN -> R.string.pace_maintain
    GoalPace.GAIN_SLOW -> R.string.pace_gain_slow
    GoalPace.GAIN -> R.string.pace_gain
}
