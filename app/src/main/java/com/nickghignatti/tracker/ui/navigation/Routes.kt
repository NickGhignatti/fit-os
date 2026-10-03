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

@Serializable
data object ProfileRoute

/** A single day, carried as [LocalDate.toEpochDay] because routes must be serializable. */
@Serializable
data class DayRoute(val epochDay: Long) {
    constructor(date: LocalDate) : this(date.toEpochDay())

    val date: LocalDate get() = LocalDate.ofEpochDay(epochDay)
}
