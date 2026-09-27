package com.nickghignatti.tracker.ui.calendar

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MonthGridTest {

    @Test
    fun `september 2026 starting monday has one leading blank`() {
        // 1 Sep 2026 is a Tuesday.
        val grid = monthGrid(YearMonth.of(2026, 9), DayOfWeek.MONDAY)

        assertNull(grid[0])
        assertEquals(LocalDate.of(2026, 9, 1), grid[1])
        assertEquals(0, grid.size % DAYS_IN_WEEK)
        assertEquals(30, grid.count { it != null })
    }

    @Test
    fun `september 2026 starting sunday has two leading blanks`() {
        val grid = monthGrid(YearMonth.of(2026, 9), DayOfWeek.SUNDAY)

        assertNull(grid[1])
        assertEquals(LocalDate.of(2026, 9, 1), grid[2])
    }

    @Test
    fun `month starting on the first weekday has no blanks`() {
        // 1 Feb 2026 is a Sunday; with Sunday first, 28 days fill exactly 4 rows.
        val grid = monthGrid(YearMonth.of(2026, 2), DayOfWeek.SUNDAY)

        assertEquals(LocalDate.of(2026, 2, 1), grid[0])
        assertEquals(28, grid.size)
    }

    @Test
    fun `ordered week wraps around`() {
        assertEquals(
            listOf(
                DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
                DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY,
            ),
            orderedWeek(DayOfWeek.SUNDAY),
        )
    }
}
