package com.nickghignatti.tracker.ui.format

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.SetPlan

/** "10 × 60 kg", or "12 reps" for bodyweight sets. */
@Composable
fun setLabel(reps: Int, weight: Double?): String =
    if (weight == null || weight == 0.0) {
        pluralStringResource(R.plurals.set_reps, reps, reps)
    } else {
        stringResource(R.string.set_weighted, reps, formatWeight(weight))
    }

/** "3 × 10 × 60 kg" when every set is the same, otherwise each set in order. */
@Composable
fun setsSummary(sets: List<SetPlan>): String = when {
    sets.isEmpty() -> stringResource(R.string.no_sets)
    sets.distinct().size == 1 -> stringResource(R.string.sets_uniform, sets.size, setLabel(sets[0].reps, sets[0].weight))
    else -> sets.map { setLabel(it.reps, it.weight) }.joinToString(" · ")
}
