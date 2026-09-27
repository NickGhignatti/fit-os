package com.nickghignatti.tracker.data.local

import androidx.room.TypeConverter
import java.time.DayOfWeek
import java.time.LocalDate

internal class Converters {
    @TypeConverter
    fun localDateToEpochDay(date: LocalDate): Long = date.toEpochDay()

    @TypeConverter
    fun epochDayToLocalDate(epochDay: Long): LocalDate = LocalDate.ofEpochDay(epochDay)

    @TypeConverter
    fun dayOfWeekToInt(day: DayOfWeek): Int = day.value

    @TypeConverter
    fun intToDayOfWeek(value: Int): DayOfWeek = DayOfWeek.of(value)
}
