package com.nickghignatti.tracker.ui.navigation

import java.time.LocalDate
import kotlinx.serialization.Serializable

@Serializable
data object TodayRoute

@Serializable
data object CalendarRoute

@Serializable
data object TemplatesRoute

@Serializable
data object DietRoute

/** A single day, carried as [LocalDate.toEpochDay] because routes must be serializable. */
@Serializable
data class DayRoute(val epochDay: Long) {
    constructor(date: LocalDate) : this(date.toEpochDay())

    val date: LocalDate get() = LocalDate.ofEpochDay(epochDay)
}
