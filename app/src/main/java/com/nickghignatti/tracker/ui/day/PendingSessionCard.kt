package com.nickghignatti.tracker.ui.day

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.PendingSession
import com.nickghignatti.tracker.ui.format.setsSummary
import com.nickghignatti.tracker.ui.theme.TrackerTheme

/** What the active plan asks for today, with a button to start logging it. */
@Composable
fun PendingSessionCard(session: PendingSession, onStart: () -> Unit, modifier: Modifier = Modifier) {
    OutlinedCard(modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                stringResource(R.string.pending_from_plan),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            Text(session.title, style = MaterialTheme.typography.titleLarge)
            session.exercises.forEach { exercise ->
                Row {
                    Text(exercise.name, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                    Text(
                        setsSummary(exercise.sets),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            FilledTonalButton(onClick = onStart, modifier = Modifier.padding(top = 4.dp)) {
                Text(stringResource(R.string.pending_start))
            }
        }
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
