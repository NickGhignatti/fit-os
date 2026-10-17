package com.nickghignatti.tracker.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.ui.theme.ChipKind
import com.nickghignatti.tracker.ui.theme.Macro
import com.nickghignatti.tracker.ui.theme.Tracker

private val CheckIconSize = 18.dp

/** Flat pill progress bar: a light track with a solid, non-gradient fill. */
@Composable
fun ProgressTrack(
    fraction: Float,
    modifier: Modifier = Modifier,
    color: Color = Tracker.colors.accent,
    trackColor: Color = Tracker.colors.track,
    thickness: Dp = Tracker.dimens.progressThickness,
) {
    Box(
        modifier
            .fillMaxWidth()
            .height(thickness)
            .clip(Tracker.dimens.chip)
            .background(trackColor),
    ) {
        Box(
            Modifier
                .fillMaxHeight()
                .fillMaxWidth(fraction.coerceIn(0f, 1f))
                .clip(Tracker.dimens.chip)
                .background(color),
        )
    }
}

/** Square 28dp completion target; filled moss green with a check when [checked]. */
@Composable
fun CheckTarget(
    checked: Boolean,
    onCheckedChange: ((Boolean) -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val colors = Tracker.colors
    val shape = Tracker.dimens.small
    Box(
        modifier
            .size(Tracker.dimens.checkSize)
            .clip(shape)
            .background(if (checked) colors.accent else colors.surface)
            .border(Tracker.dimens.borderWidth, if (checked) colors.accent else colors.border, shape)
            .then(
                if (onCheckedChange != null) {
                    Modifier.clickable(role = Role.Checkbox) { onCheckedChange(!checked) }
                } else {
                    Modifier
                },
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (checked) {
            Icon(painterResource(R.drawable.ic_check), contentDescription = null, tint = colors.onAccent, modifier = Modifier.size(CheckIconSize))
        }
    }
}

/** 24dp pill tag; colours come from `TrackerStyles.chip(kind)`. */
@Composable
fun TrackerChip(
    text: String,
    modifier: Modifier = Modifier,
    kind: ChipKind = ChipKind.Neutral,
) {
    val style = Tracker.styles.chip(kind)
    Box(
        modifier
            .height(Tracker.dimens.chipHeight)
            .clip(Tracker.dimens.chip)
            .background(style.container)
            .padding(horizontal = Tracker.dimens.sm),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = Tracker.type.labelSm, color = style.content, maxLines = 1)
    }
}

/** Outlined chip used for filters; [selected] flips it to solid ink. */
@Composable
fun FilterPill(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = Tracker.colors
    Box(
        modifier
            .height(Tracker.dimens.chipHeight + Tracker.dimens.sm)
            .clip(Tracker.dimens.chip)
            .background(if (selected) colors.ink else colors.surface)
            .border(Tracker.dimens.borderWidth, if (selected) colors.ink else colors.border, Tracker.dimens.chip)
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = Tracker.dimens.md),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = Tracker.type.labelMd, color = if (selected) colors.inkInverse else colors.ink, maxLines = 1)
    }
}

/** One macronutrient readout: name, percent of target, value over target and a thin bar in the macro's colour. */
@Composable
fun MacroTile(
    macro: Macro,
    name: String,
    value: String,
    target: String,
    fraction: Float,
    modifier: Modifier = Modifier,
    percentText: String? = null,
) {
    val color = Tracker.styles.macro(macro)
    Column(
        modifier
            .clip(Tracker.dimens.control)
            .background(Tracker.colors.surfaceMuted)
            .padding(Tracker.dimens.md),
        verticalArrangement = Arrangement.spacedBy(Tracker.dimens.xs),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(name, style = Tracker.type.labelMd, color = color)
            if (percentText != null) Text(percentText, style = Tracker.type.tabularCaption, color = Tracker.colors.inkSecondary)
        }
        Row(verticalAlignment = Alignment.Bottom) {
            Text(value, style = Tracker.type.metricMd, color = Tracker.colors.ink)
            Text(" / $target", style = Tracker.type.tabularCaption, color = Tracker.colors.inkSecondary, modifier = Modifier.padding(bottom = 3.dp))
        }
        ProgressTrack(fraction, color = color, thickness = Tracker.dimens.progressThicknessThin)
    }
}
