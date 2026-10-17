package com.nickghignatti.tracker.ui.day

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.PendingSession
import com.nickghignatti.tracker.ui.components.Hairline
import com.nickghignatti.tracker.ui.components.TrackerButton
import com.nickghignatti.tracker.ui.components.TrackerCard
import com.nickghignatti.tracker.ui.components.TrackerChip
import com.nickghignatti.tracker.ui.format.setsSummary
import com.nickghignatti.tracker.ui.theme.Tracker
import com.nickghignatti.tracker.ui.theme.TrackerTheme

/** What the active plan asks for today, with a button to start logging it. */
@Composable
fun PendingSessionCard(session: PendingSession, onStart: () -> Unit, modifier: Modifier = Modifier) {
    TrackerCard(modifier.fillMaxWidth()) {
        Text(
            stringResource(R.string.pending_from_plan).uppercase(),
            style = Tracker.type.labelSm,
            color = Tracker.colors.accent,
        )
        Text(
            session.title,
            style = Tracker.type.headlineLg,
            color = Tracker.colors.ink,
            modifier = Modifier.padding(top = Tracker.dimens.xs, bottom = Tracker.dimens.sm),
        )
        session.exercises.forEachIndexed { index, exercise ->
            Hairline()
            Row(
                Modifier.fillMaxWidth().heightIn(min = Tracker.dimens.rowMinHeight + Tracker.dimens.md),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.md),
            ) {
                Text("%02d".format(index + 1), style = Tracker.type.tabularCaption, color = Tracker.colors.inkTertiary)
                Text(exercise.name, style = Tracker.type.bodyLg, color = Tracker.colors.ink, modifier = Modifier.weight(1f))
                TrackerChip(setsSummary(exercise.sets))
            }
        }
        TrackerButton(
            text = stringResource(R.string.pending_start),
            onClick = onStart,
            icon = R.drawable.ic_play,
            modifier = Modifier.fillMaxWidth().padding(top = Tracker.dimens.md),
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun PendingSessionCardPreview() {
    TrackerTheme {
        PendingSessionCard(
            session = PendingSession(1, "Push", listOf(ExercisePlan.uniform("Bench press", "", 3, 8, 60.0))),
            onStart = {},
        )
    }
}
