package com.nickghignatti.tracker.ui.navigation

import com.nickghignatti.tracker.domain.model.PlanDay
import java.time.DayOfWeek
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
data class LogFoodRoute(val epochDay: Long, val meal: String, val scan: Boolean = false) {
    constructor(date: LocalDate, meal: String, scan: Boolean = false) : this(date.toEpochDay(), meal, scan)

    val date: LocalDate get() = LocalDate.ofEpochDay(epochDay)
}

/** Picking a food to add to a diet plan's meal. */
@Serializable
data class DietFoodRoute(val mealId: Long, val mealName: String)

@Serializable
data object ProfileRoute

@Serializable
data object ProfileEditRoute

/** Picking a catalogue exercise for a logged workout. */
@Serializable
data class WorkoutExercisePickerRoute(val workoutId: Long)

/** Picking a catalogue exercise for a plan's day. */
@Serializable
data class PlanExercisePickerRoute(val planId: Long, val day: Int) {
    constructor(planId: Long, day: PlanDay) : this(planId, day.routeValue)

    val planDay: PlanDay get() = if (day == EVERY_DAY) PlanDay.EveryDay else PlanDay.Weekday(DayOfWeek.of(day))

    private companion object {
        const val EVERY_DAY = 0
        val PlanDay.routeValue: Int
            get() = when (this) {
                PlanDay.EveryDay -> EVERY_DAY
                is PlanDay.Weekday -> day.value
            }
    }
}

@Serializable
data class ExerciseDetailRoute(val catalogId: String)

/** A single day, carried as [LocalDate.toEpochDay] because routes must be serializable. */
@Serializable
data class DayRoute(val epochDay: Long) {
    constructor(date: LocalDate) : this(date.toEpochDay())

    val date: LocalDate get() = LocalDate.ofEpochDay(epochDay)
}
