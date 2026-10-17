package com.nickghignatti.tracker.ui.profile

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.WeightEntry
import com.nickghignatti.tracker.ui.format.formatWeight
import com.nickghignatti.tracker.ui.format.formatted
import java.time.format.FormatStyle
import kotlin.math.abs

/**
 * Body weight over time: one series, so no legend (the card's title names it). A thin line with a
 * marker on the latest weigh-in; dragging or tapping shows a crosshair and that day's value, which
 * replaces the latest one in the readout above. The weigh-in list below the chart is its table view.
 */
@Composable
fun WeightChart(entries: List<WeightEntry>, modifier: Modifier = Modifier) {
    if (entries.size < 2) return
    var selected by remember(entries) { mutableStateOf<Int?>(null) }
    val shown = entries[selected ?: entries.lastIndex]

    val colors = MaterialTheme.colorScheme
    val minKg = entries.minOf { it.kg }
    val maxKg = entries.maxOf { it.kg }
    // Pad the range so a flat line is not glued to an edge.
    val padding = maxOf((maxKg - minKg) * 0.15, 0.5)
    val low = minKg - padding
    val high = maxKg + padding
    val firstDay = entries.first().date.toEpochDay()
    val span = maxOf(1L, entries.last().date.toEpochDay() - firstDay).toFloat()
    val description = stringResource(
        R.string.weight_chart_description,
        formatWeight(entries.first().kg), formatWeight(entries.last().kg), entries.size,
    )

    Column(modifier) {
        Text(
            stringResource(R.string.weight_chart_readout, shown.date.formatted(FormatStyle.MEDIUM), formatWeight(shown.kg)),
            style = MaterialTheme.typography.bodyMedium,
            color = colors.onSurfaceVariant,
        )
        Box(Modifier.fillMaxWidth().padding(top = 8.dp)) {
            Canvas(
                Modifier
                    .fillMaxWidth()
                    .height(CHART_HEIGHT)
                    .semantics { contentDescription = description }
                    .pointerInput(entries) {
                        detectTapGestures { selected = entries.nearestIndex(it.x, size.width, firstDay, span) }
                    }
                    .pointerInput(entries) {
                        detectDragGestures(
                            onDragStart = { selected = entries.nearestIndex(it.x, size.width, firstDay, span) },
                            onDrag = { change, _ -> selected = entries.nearestIndex(change.position.x, size.width, firstDay, span) },
                        )
                    },
            ) {
                val inset = MARKER_RADIUS.toPx()
                val width = size.width - 2 * inset
                val height = size.height - 2 * inset
                fun point(entry: WeightEntry) = Offset(
                    x = inset + (entry.date.toEpochDay() - firstDay) / span * width,
                    y = inset + ((high - entry.kg) / (high - low)).toFloat() * height,
                )

                // Recessive guides at the lowest and highest weight.
                val dash = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx()))
                for (kg in listOf(minKg, maxKg)) {
                    val y = inset + ((high - kg) / (high - low)).toFloat() * height
                    drawLine(colors.outlineVariant, Offset(0f, y), Offset(size.width, y), 1.dp.toPx(), pathEffect = dash)
                }

                val path = Path().apply {
                    entries.forEachIndexed { index, entry ->
                        val p = point(entry)
                        if (index == 0) moveTo(p.x, p.y) else lineTo(p.x, p.y)
                    }
                }
                drawPath(path, colors.primary, style = Stroke(2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))

                selected?.let { index ->
                    val x = point(entries[index]).x
                    drawLine(colors.outline, Offset(x, 0f), Offset(x, size.height), 1.dp.toPx())
                }
                // A surface ring keeps the marker readable where it overlaps the line.
                val marker = point(shown)
                drawCircle(colors.surface, MARKER_RADIUS.toPx() + 2.dp.toPx(), marker)
                drawCircle(colors.primary, MARKER_RADIUS.toPx(), marker)
            }
            AxisLabel(stringResource(R.string.kg_value, formatWeight(maxKg)), Modifier.align(Alignment.TopStart))
            AxisLabel(stringResource(R.string.kg_value, formatWeight(minKg)), Modifier.align(Alignment.BottomStart))
        }
        Row(Modifier.fillMaxWidth().padding(top = 4.dp)) {
            AxisLabel(entries.first().date.formatted(FormatStyle.SHORT))
            Spacer(Modifier.weight(1f))
            AxisLabel(entries.last().date.formatted(FormatStyle.SHORT))
        }
    }
}

@Composable
private fun AxisLabel(text: String, modifier: Modifier = Modifier) {
    Text(text, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = modifier)
}

/** The weigh-in drawn closest to [x] across a chart [width] pixels wide. */
private fun List<WeightEntry>.nearestIndex(x: Float, width: Int, firstDay: Long, span: Float): Int =
    indices.minBy { index -> abs((this[index].date.toEpochDay() - firstDay) / span * width - x) }

private val CHART_HEIGHT = 140.dp
private val MARKER_RADIUS = 4.dp
