package com.nickghignatti.tracker.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.runtime.Immutable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.nickghignatti.tracker.R

/** Geist as a variable font, so each weight is a real instance and not a synthesised one. */
private fun geist(weight: FontWeight) = Font(
    R.font.geist,
    weight = weight,
    variationSettings = FontVariation.Settings(FontVariation.weight(weight.weight)),
)

val GeistFamily = FontFamily(geist(FontWeight.Normal), geist(FontWeight.Medium), geist(FontWeight.SemiBold))

/** Tabular figures keep columns of numbers aligned; the design requires them on every readout. */
private const val TABULAR = "tnum"

private fun style(
    size: Int,
    line: Int,
    weight: FontWeight,
    tracking: TextUnit,
    tabular: Boolean = false,
) = TextStyle(
    fontFamily = GeistFamily,
    fontSize = size.sp,
    lineHeight = line.sp,
    fontWeight = weight,
    letterSpacing = tracking,
    fontFeatureSettings = if (tabular) TABULAR else null,
)

/** The design system's named text styles. Edit sizes and weights here. */
@Immutable
data class TrackerType(
    val displayLg: TextStyle = style(36, 40, FontWeight.SemiBold, (-0.025).em),
    val headlineLg: TextStyle = style(24, 30, FontWeight.SemiBold, (-0.015).em),
    val headlineMd: TextStyle = style(20, 26, FontWeight.Medium, (-0.01).em),
    val metricXl: TextStyle = style(38, 42, FontWeight.SemiBold, (-0.03).em, tabular = true),
    val metricMd: TextStyle = style(22, 26, FontWeight.SemiBold, (-0.02).em, tabular = true),
    val bodyLg: TextStyle = style(16, 24, FontWeight.Normal, (-0.005).em),
    val bodyMd: TextStyle = style(14, 20, FontWeight.Normal, 0.em),
    val bodySm: TextStyle = style(13, 18, FontWeight.Normal, 0.em),
    val labelMd: TextStyle = style(13, 16, FontWeight.Medium, 0.01.em),
    val labelSm: TextStyle = style(11, 14, FontWeight.SemiBold, 0.04.em),
    val tabularCaption: TextStyle = style(12, 16, FontWeight.Medium, 0.02.em, tabular = true),
)

/** Material text roles mapped onto the design styles so stock components stay on-brand. */
internal fun TrackerType.toMaterial() = Typography(
    displayLarge = displayLg,
    displayMedium = displayLg,
    displaySmall = headlineLg,
    headlineLarge = headlineLg,
    headlineMedium = headlineLg,
    headlineSmall = headlineMd,
    titleLarge = headlineMd,
    titleMedium = bodyLg.copy(fontWeight = FontWeight.Medium),
    titleSmall = labelMd,
    bodyLarge = bodyLg,
    bodyMedium = bodyMd,
    bodySmall = bodySm,
    labelLarge = labelMd,
    labelMedium = labelMd,
    labelSmall = labelSm,
)
