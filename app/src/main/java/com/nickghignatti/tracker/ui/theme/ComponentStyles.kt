package com.nickghignatti.tracker.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

enum class ButtonKind { Primary, Secondary, Positive }

enum class ChipKind { Neutral, Accent, Protein, Carbs, Fat }

enum class Macro { Protein, Carbs, Fat }

@Immutable
data class ButtonStyle(
    val container: Color,
    val pressedContainer: Color,
    val content: Color,
    /** Null for solid buttons. */
    val border: Color? = null,
)

@Immutable
data class ChipStyle(val container: Color, val content: Color)

/**
 * Per-component styling, derived from the palette by default. Components read from here and never
 * pick colours themselves, so restyling a button or chip kind is a change in [defaultFor] (or a
 * custom instance passed to `TrackerTheme`).
 */
@Immutable
data class TrackerStyles(
    val buttons: Map<ButtonKind, ButtonStyle>,
    val chips: Map<ChipKind, ChipStyle>,
    val macros: Map<Macro, Color>,
    val macroContainers: Map<Macro, Color>,
) {
    fun button(kind: ButtonKind) = buttons.getValue(kind)
    fun chip(kind: ChipKind) = chips.getValue(kind)
    fun macro(macro: Macro) = macros.getValue(macro)
    fun macroContainer(macro: Macro) = macroContainers.getValue(macro)

    companion object {
        fun defaultFor(c: TrackerColors) = TrackerStyles(
            buttons = mapOf(
                ButtonKind.Primary to ButtonStyle(c.ink, c.inkPressed, c.inkInverse),
                ButtonKind.Secondary to ButtonStyle(c.surface, c.surfaceMuted, c.ink, border = c.border),
                ButtonKind.Positive to ButtonStyle(c.accent, c.accent, c.onAccent),
            ),
            chips = mapOf(
                ChipKind.Neutral to ChipStyle(c.chip, c.onChip),
                ChipKind.Accent to ChipStyle(c.accentContainer, c.onAccentContainer),
                ChipKind.Protein to ChipStyle(c.proteinContainer, c.protein),
                ChipKind.Carbs to ChipStyle(c.carbsContainer, c.carbs),
                ChipKind.Fat to ChipStyle(c.fatContainer, c.fat),
            ),
            macros = mapOf(Macro.Protein to c.protein, Macro.Carbs to c.carbs, Macro.Fat to c.fat),
            macroContainers = mapOf(
                Macro.Protein to c.proteinContainer,
                Macro.Carbs to c.carbsContainer,
                Macro.Fat to c.fatContainer,
            ),
        )
    }
}
