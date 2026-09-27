package com.nickghignatti.tracker.ui.format

import java.math.BigDecimal
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.format.TextStyle
import java.util.Locale

/** Accepts both "62.5" and "62,5"; blank or invalid input yields null. */
fun parseWeight(text: String): Double? =
    text.trim().replace(',', '.').toDoubleOrNull()?.takeIf { it >= 0 && it.isFinite() }

fun formatWeight(weight: Double): String =
    BigDecimal.valueOf(weight).stripTrailingZeros().toPlainString()

/** Localized day name with a capital first letter (some locales, e.g. Italian, lowercase them). */
fun DayOfWeek.displayName(style: TextStyle = TextStyle.FULL, locale: Locale = Locale.getDefault()): String =
    getDisplayName(style, locale).replaceFirstChar { it.titlecase(locale) }

fun LocalDate.formatted(style: FormatStyle): String = format(DateTimeFormatter.ofLocalizedDate(style))

fun YearMonth.displayName(locale: Locale = Locale.getDefault()): String =
    format(DateTimeFormatter.ofPattern("LLLL yyyy", locale)).replaceFirstChar { it.titlecase(locale) }
