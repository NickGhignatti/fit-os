package com.nickghignatti.tracker.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.ui.theme.Tracker

private val SegmentedInset = 2.dp

/** Segmented switcher: muted container, white active tab with a hairline border. */
@Composable
fun <T> SegmentedSwitcher(
    options: List<T>,
    selected: T?,
    onSelect: (T) -> Unit,
    label: @Composable (T) -> String,
    modifier: Modifier = Modifier,
) {
    val colors = Tracker.colors
    Row(
        modifier
            .fillMaxWidth()
            .height(Tracker.dimens.segmentedHeight)
            .clip(Tracker.dimens.small)
            .background(colors.surfaceMuted)
            .padding(SegmentedInset),
    ) {
        options.forEach { option ->
            val active = option == selected
            Box(
                Modifier
                    .weight(1f)
                    .height(Tracker.dimens.segmentedHeight - SegmentedInset * 2)
                    .clip(Tracker.dimens.small)
                    .then(
                        if (active) {
                            Modifier
                                .background(colors.surface)
                                .border(Tracker.dimens.borderWidth, colors.border, Tracker.dimens.small)
                        } else {
                            Modifier
                        },
                    )
                    .clickable(role = Role.Tab) { onSelect(option) },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label(option),
                    style = Tracker.type.labelMd,
                    color = if (active) colors.ink else colors.inkSecondary,
                    maxLines = 1,
                )
            }
        }
    }
}

data class BottomBarItem(val label: String, @param:DrawableRes val icon: Int)

/** Fixed bottom bar: white, top hairline, ink for the active node with a micro-dot under its label. */
@Composable
fun TrackerBottomBar(
    items: List<BottomBarItem>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = Tracker.colors
    Column(modifier.background(colors.surface).navigationBarsPadding()) {
        Hairline()
        Row(Modifier.fillMaxWidth().height(Tracker.dimens.navHeight)) {
            items.forEachIndexed { index, item ->
                val active = index == selectedIndex
                val tint = if (active) colors.ink else colors.inkTertiary
                Column(
                    Modifier
                        .weight(1f)
                        .height(Tracker.dimens.navHeight)
                        .clickable(role = Role.Tab) { onSelect(index) },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(Tracker.dimens.xs, Alignment.CenterVertically),
                ) {
                    Icon(painterResource(item.icon), contentDescription = null, tint = tint, modifier = Modifier.size(Tracker.dimens.navIcon))
                    Text(item.label, style = Tracker.type.labelMd, color = tint, maxLines = 1)
                    Box(
                        Modifier
                            .size(Tracker.dimens.navDot)
                            .clip(Tracker.dimens.chip)
                            .background(if (active) colors.ink else Color.Transparent),
                    )
                }
            }
        }
    }
}

/** Screen header: bold title with an optional caption, white with a bottom hairline. */
@Composable
fun TrackerTopBar(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    navigation: (@Composable () -> Unit)? = null,
    actions: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit = {},
) {
    Column(modifier.background(Tracker.colors.surface).statusBarsPadding()) {
        Row(
            Modifier
                .fillMaxWidth()
                .height(Tracker.dimens.navHeight)
                .padding(horizontal = Tracker.dimens.pageMargin),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.md),
        ) {
            navigation?.invoke()
            Column(Modifier.weight(1f)) {
                Text(title, style = Tracker.type.headlineMd, color = Tracker.colors.ink, maxLines = 1)
                if (subtitle != null) {
                    Text(subtitle, style = Tracker.type.bodySm, color = Tracker.colors.inkSecondary, maxLines = 1)
                }
            }
            actions()
        }
        Hairline()
    }
}

/** Arrow-back icon button for [TrackerTopBar]'s `navigation` slot. */
@Composable
fun TrackerBackButton(onBack: () -> Unit) {
    IconButton(onClick = onBack) {
        Icon(painterResource(R.drawable.ic_arrow_back), stringResource(R.string.action_back))
    }
}
