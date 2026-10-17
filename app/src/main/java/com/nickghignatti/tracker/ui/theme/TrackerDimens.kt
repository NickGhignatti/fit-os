package com.nickghignatti.tracker.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.res.dimensionResource
import androidx.compose.ui.unit.Dp
import com.nickghignatti.tracker.R

/** Shapes, spacing and component sizes, loaded from `res/values/dimens.xml`. */
@Immutable
data class TrackerDimens(
    val card: RoundedCornerShape,
    val control: RoundedCornerShape,
    val input: RoundedCornerShape,
    val small: RoundedCornerShape,
    val chip: RoundedCornerShape,
    val xs: Dp,
    val sm: Dp,
    val md: Dp,
    val lg: Dp,
    val xl: Dp,
    val xxl: Dp,
    val pageMargin: Dp,
    val borderWidth: Dp,
    val borderWidthFocused: Dp,
    val buttonHeight: Dp,
    val buttonHeightCompact: Dp,
    val inputHeight: Dp,
    val segmentedHeight: Dp,
    val chipHeight: Dp,
    val checkSize: Dp,
    val rowMinHeight: Dp,
    val progressThickness: Dp,
    val progressThicknessThin: Dp,
    val navHeight: Dp,
    val navIcon: Dp,
    val navDot: Dp,
)

@Composable
internal fun loadTrackerDimens() = TrackerDimens(
    card = RoundedCornerShape(dimensionResource(R.dimen.radius_card)),
    control = RoundedCornerShape(dimensionResource(R.dimen.radius_control)),
    input = RoundedCornerShape(dimensionResource(R.dimen.radius_input)),
    small = RoundedCornerShape(dimensionResource(R.dimen.radius_small)),
    chip = RoundedCornerShape(dimensionResource(R.dimen.radius_chip)),
    xs = dimensionResource(R.dimen.space_xs),
    sm = dimensionResource(R.dimen.space_sm),
    md = dimensionResource(R.dimen.space_md),
    lg = dimensionResource(R.dimen.space_lg),
    xl = dimensionResource(R.dimen.space_xl),
    xxl = dimensionResource(R.dimen.space_2xl),
    pageMargin = dimensionResource(R.dimen.page_margin),
    borderWidth = dimensionResource(R.dimen.border_width),
    borderWidthFocused = dimensionResource(R.dimen.border_width_focused),
    buttonHeight = dimensionResource(R.dimen.button_height),
    buttonHeightCompact = dimensionResource(R.dimen.button_height_compact),
    inputHeight = dimensionResource(R.dimen.input_height),
    segmentedHeight = dimensionResource(R.dimen.segmented_height),
    chipHeight = dimensionResource(R.dimen.chip_height),
    checkSize = dimensionResource(R.dimen.check_size),
    rowMinHeight = dimensionResource(R.dimen.row_min_height),
    progressThickness = dimensionResource(R.dimen.progress_thickness),
    progressThicknessThin = dimensionResource(R.dimen.progress_thickness_thin),
    navHeight = dimensionResource(R.dimen.nav_height),
    navIcon = dimensionResource(R.dimen.nav_icon),
    navDot = dimensionResource(R.dimen.nav_dot),
)
