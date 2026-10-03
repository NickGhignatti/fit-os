package com.nickghignatti.tracker.data.local

import androidx.room.TypeConverter
import com.nickghignatti.tracker.domain.model.PlanDay
import java.time.DayOfWeek
import java.time.LocalDate

internal class Converters {
    @TypeConverter
    fun localDateToEpochDay(date: LocalDate): Long = date.toEpochDay()

    @TypeConverter
    fun epochDayToLocalDate(epochDay: Long): LocalDate = LocalDate.ofEpochDay(epochDay)

    /** 0 for every day, otherwise the ISO weekday (1 = Monday … 7 = Sunday). */
    @TypeConverter
    fun planDayToInt(day: PlanDay): Int = when (day) {
        PlanDay.EveryDay -> EVERY_DAY
        is PlanDay.Weekday -> day.day.value
    }

    @TypeConverter
    fun intToPlanDay(value: Int): PlanDay =
        if (value == EVERY_DAY) PlanDay.EveryDay else PlanDay.Weekday(DayOfWeek.of(value))

    private companion object {
        const val EVERY_DAY = 0
    }
}
