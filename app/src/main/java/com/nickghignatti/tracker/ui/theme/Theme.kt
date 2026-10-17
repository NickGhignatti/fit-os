package com.nickghignatti.tracker.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf

private val LocalTrackerColors = staticCompositionLocalOf<TrackerColors> { error("TrackerTheme missing") }
private val LocalTrackerType = staticCompositionLocalOf<TrackerType> { error("TrackerTheme missing") }
private val LocalTrackerDimens = staticCompositionLocalOf<TrackerDimens> { error("TrackerTheme missing") }
private val LocalTrackerStyles = staticCompositionLocalOf<TrackerStyles> { error("TrackerTheme missing") }

/** Entry point for design tokens: `Tracker.colors.accent`, `Tracker.type.metricXl`, `Tracker.dimens.card`. */
object Tracker {
    val colors: TrackerColors
        @Composable @ReadOnlyComposable get() = LocalTrackerColors.current
    val type: TrackerType
        @Composable @ReadOnlyComposable get() = LocalTrackerType.current
    val dimens: TrackerDimens
        @Composable @ReadOnlyComposable get() = LocalTrackerDimens.current
    val styles: TrackerStyles
        @Composable @ReadOnlyComposable get() = LocalTrackerStyles.current
}

/**
 * Applies the design tokens (colours and sizes from XML, type from [TrackerType]) and mirrors them
 * into Material so stock components inherit the look. Dynamic colour is intentionally not used:
 * the palette is part of the design.
 */
@Composable
fun TrackerTheme(
    type: TrackerType = TrackerType(),
    styles: (TrackerColors) -> TrackerStyles = TrackerStyles::defaultFor,
    content: @Composable () -> Unit,
) {
    val colors = loadTrackerColors()
    val dimens = loadTrackerDimens()
    CompositionLocalProvider(
        LocalTrackerColors provides colors,
        LocalTrackerType provides type,
        LocalTrackerDimens provides dimens,
        LocalTrackerStyles provides styles(colors),
    ) {
        MaterialTheme(
            colorScheme = colors.toMaterial(),
            typography = type.toMaterial(),
            shapes = Shapes(
                extraSmall = dimens.input,
                small = dimens.small,
                medium = dimens.control,
                large = dimens.card,
                extraLarge = dimens.card,
            ),
            content = content,
        )
    }
}
