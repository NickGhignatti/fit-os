package com.nickghignatti.tracker.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import com.nickghignatti.tracker.ui.theme.Tracker

/**
 * White card on the canvas with a hairline border. Selection changes the border, never adds a
 * shadow ([borderColor] defaults to ink when [selected]).
 */
@Composable
fun TrackerCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    selected: Boolean = false,
    borderColor: Color = if (selected) Tracker.colors.ink else Tracker.colors.border,
    containerColor: Color = Tracker.colors.surface,
    contentPadding: PaddingValues = PaddingValues(Tracker.dimens.lg),
    content: @Composable ColumnScope.() -> Unit,
) {
    val border = BorderStroke(Tracker.dimens.borderWidth, borderColor)
    val body: @Composable () -> Unit = {
        Column(Modifier.padding(contentPadding), content = content)
    }
    if (onClick != null) {
        Surface(
            onClick = onClick,
            modifier = modifier,
            shape = Tracker.dimens.card,
            color = containerColor,
            border = border,
            content = body,
        )
    } else {
        Surface(
            modifier = modifier,
            shape = Tracker.dimens.card,
            color = containerColor,
            border = border,
            content = body,
        )
    }
}

/** Small uppercase caption above a group, with an optional right-aligned note. */
@Composable
fun SectionLabel(
    text: String,
    modifier: Modifier = Modifier,
    trailing: String? = null,
    trailingColor: Color = Tracker.colors.inkSecondary,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text.uppercase(),
            style = Tracker.type.labelSm,
            color = Tracker.colors.inkSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false),
        )
        if (trailing != null) {
            Text(trailing, style = Tracker.type.labelSm, color = trailingColor, maxLines = 1)
        }
    }
}

@Composable
fun Hairline(modifier: Modifier = Modifier) {
    HorizontalDivider(modifier, thickness = Tracker.dimens.borderWidth, color = Tracker.colors.divider)
}
