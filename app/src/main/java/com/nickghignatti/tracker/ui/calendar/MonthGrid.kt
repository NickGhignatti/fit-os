package com.nickghignatti.tracker.ui.calendar

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth

/**
 * Cells for a month view, row-major, 7 per row. Leading/trailing cells outside the
 * month are null so the grid always has complete weeks.
 */
fun monthGrid(month: YearMonth, firstDayOfWeek: DayOfWeek): List<LocalDate?> {
    val leading = (month.atDay(1).dayOfWeek.value - firstDayOfWeek.value + DAYS_IN_WEEK) % DAYS_IN_WEEK
    val cells: List<LocalDate?> = List(leading) { null } + (1..month.lengthOfMonth()).map(month::atDay)
    val trailing = (DAYS_IN_WEEK - cells.size % DAYS_IN_WEEK) % DAYS_IN_WEEK
    return cells + List(trailing) { null }
}

fun orderedWeek(firstDayOfWeek: DayOfWeek): List<DayOfWeek> =
    (0L until DAYS_IN_WEEK).map(firstDayOfWeek::plus)

const val DAYS_IN_WEEK = 7
