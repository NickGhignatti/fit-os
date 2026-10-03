package com.nickghignatti.tracker.ui.navigation

import java.time.LocalDate
import kotlinx.serialization.Serializable

@Serializable
data object TrainingRoute

@Serializable
data class TrainingPlanRoute(val planId: Long)

@Serializable
data object DietRoute

@Serializable
data class DietPlanRoute(val planId: Long)

@Serializable
data object TodayRoute

@Serializable
data object CaloriesRoute

/** Picking a food to log as eaten, on a day and under a meal. */
@Serializable
data class LogFoodRoute(val epochDay: Long, val meal: String) {
    constructor(date: LocalDate, meal: String) : this(date.toEpochDay(), meal)

    val date: LocalDate get() = LocalDate.ofEpochDay(epochDay)
}

/** Picking a food to add to a diet plan's meal. */
@Serializable
data class DietFoodRoute(val mealId: Long, val mealName: String)

@Serializable
data object ProfileRoute

/** A single day, carried as [LocalDate.toEpochDay] because routes must be serializable. */
@Serializable
data class DayRoute(val epochDay: Long) {
    constructor(date: LocalDate) : this(date.toEpochDay())

    val date: LocalDate get() = LocalDate.ofEpochDay(epochDay)
}
