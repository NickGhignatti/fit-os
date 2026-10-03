package com.nickghignatti.tracker.ui.food

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.FoodItem
import com.nickghignatti.tracker.domain.model.Nutrients
import com.nickghignatti.tracker.domain.model.Portion
import com.nickghignatti.tracker.ui.components.CancelButton
import com.nickghignatti.tracker.ui.components.NumberField
import com.nickghignatti.tracker.ui.components.SentenceTextField
import com.nickghignatti.tracker.ui.format.formatWeight
import com.nickghignatti.tracker.ui.format.parseWeight

private const val DEFAULT_GRAMS = 100.0

/** Asks how much of [food]; shows its calories as the amount changes. With [onDelete], edits an existing amount. */
@Composable
fun AmountDialog(
    food: FoodItem,
    confirmLabel: String,
    onConfirm: (grams: Double) -> Unit,
    onDismiss: () -> Unit,
    initialGrams: Double = food.servingGrams ?: DEFAULT_GRAMS,
    onDelete: (() -> Unit)? = null,
) {
    var grams by rememberSaveable { mutableStateOf(formatWeight(initialGrams)) }
    val gramsValue = parseWeight(grams)?.takeIf { it > 0 }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(food.name) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    foodOriginLabel(food) + " · " + stringResource(R.string.per_100g, kcalLabel(food.per100g.kcal)),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                NumberField(
                    grams, { grams = it }, stringResource(R.string.label_grams), Modifier.fillMaxWidth(),
                    decimal = true, isError = gramsValue == null,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    AssistChip(onClick = { grams = formatWeight(DEFAULT_GRAMS) }, label = { Text(stringResource(R.string.amount_100g)) })
                    food.servingGrams?.let { serving ->
                        AssistChip(
                            onClick = { grams = formatWeight(serving) },
                            label = { Text(stringResource(R.string.amount_serving, formatWeight(serving))) },
                        )
                    }
                }
                gramsValue?.let { value ->
                    val nutrients = Portion(food, value).nutrients
                    Text(kcalLabel(nutrients.kcal), style = MaterialTheme.typography.titleLarge)
                    Text(
                        macrosLabel(nutrients),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(gramsValue!!) }, enabled = gramsValue != null) { Text(confirmLabel) }
        },
        dismissButton = {
            Row {
                if (onDelete != null) TextButton(onClick = onDelete) { Text(stringResource(R.string.action_delete)) }
                CancelButton(onDismiss)
            }
        },
    )
}

/** A food that is in no database: the user copies the values from the label, per 100 g. */
@Composable
fun CustomFoodDialog(
    initialName: String,
    onSave: (name: String, per100g: Nutrients, servingGrams: Double?) -> Unit,
    onDismiss: () -> Unit,
) {
    var name by rememberSaveable { mutableStateOf(initialName) }
    var kcal by rememberSaveable { mutableStateOf("") }
    var protein by rememberSaveable { mutableStateOf("") }
    var carbs by rememberSaveable { mutableStateOf("") }
    var fat by rememberSaveable { mutableStateOf("") }
    var serving by rememberSaveable { mutableStateOf("") }

    val kcalValue = parseWeight(kcal)
    val macros = listOf(protein, carbs, fat).map { if (it.isBlank()) 0.0 else parseWeight(it) }
    val servingValue = parseWeight(serving)?.takeIf { it > 0 }
    val servingValid = serving.isBlank() || servingValue != null
    val valid = name.isNotBlank() && kcalValue != null && macros.all { it != null } && servingValid

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.dialog_custom_food_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SentenceTextField(name, { name = it }, stringResource(R.string.label_food), Modifier.fillMaxWidth())
                Text(
                    stringResource(R.string.dialog_custom_food_hint),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NumberField(kcal, { kcal = it }, stringResource(R.string.label_kcal), Modifier.weight(1f), decimal = true, isError = kcalValue == null)
                    NumberField(protein, { protein = it }, stringResource(R.string.label_protein), Modifier.weight(1f), decimal = true, isError = macros[0] == null)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NumberField(carbs, { carbs = it }, stringResource(R.string.label_carbs), Modifier.weight(1f), decimal = true, isError = macros[1] == null)
                    NumberField(fat, { fat = it }, stringResource(R.string.label_fat), Modifier.weight(1f), decimal = true, isError = macros[2] == null)
                }
                NumberField(
                    serving, { serving = it }, stringResource(R.string.label_serving_optional), Modifier.fillMaxWidth(),
                    decimal = true, isError = !servingValid,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val (p, c, f) = macros.map { it!! }
                    onSave(name.trim(), Nutrients(kcalValue!!, p, c, f), servingValue)
                },
                enabled = valid,
            ) { Text(stringResource(R.string.action_save)) }
        },
        dismissButton = { CancelButton(onDismiss) },
    )
}
