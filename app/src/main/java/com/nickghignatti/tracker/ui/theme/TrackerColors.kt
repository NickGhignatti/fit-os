package com.nickghignatti.tracker.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.colorResource
import com.nickghignatti.tracker.R

/** Role-named palette, loaded from `res/values/colors.xml`. */
@Immutable
data class TrackerColors(
    val canvas: Color,
    val surface: Color,
    val surfaceMuted: Color,
    val track: Color,
    val border: Color,
    val divider: Color,
    val ink: Color,
    val inkSecondary: Color,
    val inkTertiary: Color,
    val inkInverse: Color,
    val inkPressed: Color,
    val accent: Color,
    val onAccent: Color,
    val accentContainer: Color,
    val onAccentContainer: Color,
    val protein: Color,
    val proteinContainer: Color,
    val carbs: Color,
    val carbsContainer: Color,
    val fat: Color,
    val fatContainer: Color,
    val chip: Color,
    val onChip: Color,
    val danger: Color,
    val dangerContainer: Color,
)

@Composable
internal fun loadTrackerColors() = TrackerColors(
    canvas = colorResource(R.color.canvas),
    surface = colorResource(R.color.surface),
    surfaceMuted = colorResource(R.color.surface_muted),
    track = colorResource(R.color.track),
    border = colorResource(R.color.border),
    divider = colorResource(R.color.divider),
    ink = colorResource(R.color.ink),
    inkSecondary = colorResource(R.color.ink_secondary),
    inkTertiary = colorResource(R.color.ink_tertiary),
    inkInverse = colorResource(R.color.ink_inverse),
    inkPressed = colorResource(R.color.ink_pressed),
    accent = colorResource(R.color.accent),
    onAccent = colorResource(R.color.on_accent),
    accentContainer = colorResource(R.color.accent_container),
    onAccentContainer = colorResource(R.color.on_accent_container),
    protein = colorResource(R.color.protein),
    proteinContainer = colorResource(R.color.protein_container),
    carbs = colorResource(R.color.carbs),
    carbsContainer = colorResource(R.color.carbs_container),
    fat = colorResource(R.color.fat),
    fatContainer = colorResource(R.color.fat_container),
    chip = colorResource(R.color.chip),
    onChip = colorResource(R.color.on_chip),
    danger = colorResource(R.color.danger),
    dangerContainer = colorResource(R.color.danger_container),
)

/**
 * Maps the design palette onto Material 3 so stock components pick it up. Primary is ink
 * (solid obsidian actions); the moss green is `secondary` and reserved for completion.
 */
internal fun TrackerColors.toMaterial(): ColorScheme = lightColorScheme(
    primary = ink,
    onPrimary = inkInverse,
    primaryContainer = surfaceMuted,
    onPrimaryContainer = ink,
    secondary = accent,
    onSecondary = onAccent,
    secondaryContainer = accentContainer,
    onSecondaryContainer = onAccentContainer,
    tertiary = protein,
    onTertiary = inkInverse,
    tertiaryContainer = proteinContainer,
    onTertiaryContainer = protein,
    background = canvas,
    onBackground = ink,
    surface = surface,
    onSurface = ink,
    surfaceVariant = track,
    onSurfaceVariant = inkSecondary,
    surfaceTint = Color.Transparent,
    inverseSurface = ink,
    inverseOnSurface = inkInverse,
    error = danger,
    onError = inkInverse,
    errorContainer = dangerContainer,
    onErrorContainer = danger,
    outline = border,
    outlineVariant = divider,
    surfaceBright = surface,
    surfaceDim = surfaceMuted,
    surfaceContainerLowest = surface,
    surfaceContainerLow = surface,
    surfaceContainer = surface,
    surfaceContainerHigh = surfaceMuted,
    surfaceContainerHighest = track,
)
