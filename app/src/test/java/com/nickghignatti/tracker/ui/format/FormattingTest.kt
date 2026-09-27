package com.nickghignatti.tracker.ui.format

import java.time.DayOfWeek
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FormattingTest {

    @Test
    fun `parses dot and comma decimals`() {
        assertEquals(62.5, parseWeight("62.5")!!, 0.0)
        assertEquals(62.5, parseWeight(" 62,5 ")!!, 0.0)
    }

    @Test
    fun `rejects blank, negative and garbage weights`() {
        assertNull(parseWeight(""))
        assertNull(parseWeight("-5"))
        assertNull(parseWeight("abc"))
        assertNull(parseWeight("NaN"))
    }

    @Test
    fun `formats weights without trailing zeros`() {
        assertEquals("60", formatWeight(60.0))
        assertEquals("62.5", formatWeight(62.5))
        assertEquals("100", formatWeight(100.0))
    }

    @Test
    fun `day names are capitalized`() {
        assertEquals("Lunedì", DayOfWeek.MONDAY.displayName(TextStyle.FULL, Locale.ITALIAN))
        assertEquals("Monday", DayOfWeek.MONDAY.displayName(TextStyle.FULL, Locale.ENGLISH))
    }

    @Test
    fun `month names are capitalized`() {
        assertEquals("Settembre 2026", YearMonth.of(2026, 9).displayName(Locale.ITALIAN))
        assertEquals("September 2026", YearMonth.of(2026, 9).displayName(Locale.ENGLISH))
    }
}
