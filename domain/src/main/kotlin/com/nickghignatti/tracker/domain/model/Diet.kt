package com.nickghignatti.tracker.domain.model

import java.time.DayOfWeek

/** A meal in the weekly plan; each weekday has its own list. */
data class Meal(
    val id: Long,
    val day: DayOfWeek,
    val name: String,
    /** Free text such as "08:00"; empty when unset. */
    val time: String,
    val foods: List<Food>,
)

data class Food(
    val id: Long,
    val name: String,
    /** Free text such as "80 g" or "1 cup". */
    val quantity: String,
)
