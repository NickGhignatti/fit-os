package com.nickghignatti.tracker.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.ui.theme.ButtonKind
import com.nickghignatti.tracker.ui.theme.Tracker

private const val DISABLED_ALPHA = 0.4f
private val ButtonIconSize = 18.dp

/** Design-system button; colours come from `TrackerStyles.button(kind)`. */
@Composable
fun TrackerButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    kind: ButtonKind = ButtonKind.Primary,
    @DrawableRes icon: Int? = null,
    compact: Boolean = false,
    enabled: Boolean = true,
) {
    val style = Tracker.styles.button(kind)
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    Surface(
        onClick = onClick,
        enabled = enabled,
        interactionSource = interaction,
        modifier = modifier
            .height(if (compact) Tracker.dimens.buttonHeightCompact else Tracker.dimens.buttonHeight)
            .alpha(if (enabled) 1f else DISABLED_ALPHA),
        shape = Tracker.dimens.control,
        color = if (pressed) style.pressedContainer else style.container,
        contentColor = style.content,
        border = style.border?.let { BorderStroke(Tracker.dimens.borderWidth, it) },
    ) {
        Row(
            modifier = Modifier.padding(horizontal = Tracker.dimens.lg),
            horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.sm, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (icon != null) Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(ButtonIconSize))
            Text(text, style = Tracker.type.labelMd, maxLines = 1)
        }
    }
}

/** Floating primary action: the solid ink button with a leading plus, for Scaffold's FAB slot. */
@Composable
fun TrackerFab(text: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    TrackerButton(text, onClick, modifier, icon = R.drawable.ic_add)
}
