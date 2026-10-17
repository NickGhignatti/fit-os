@file:OptIn(ExperimentalMaterial3Api::class)

package com.nickghignatti.tracker.ui.food

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.ui.components.SectionLabel
import com.nickghignatti.tracker.ui.theme.Tracker
import com.nickghignatti.tracker.ui.components.ProgressTrack
import com.nickghignatti.tracker.ui.components.TrackerTopBar
import com.nickghignatti.tracker.ui.components.TrackerBackButton
import com.nickghignatti.tracker.domain.model.FoodItem
import com.nickghignatti.tracker.ui.diet.FoodDialog
import kotlinx.coroutines.launch

@Composable
fun FoodSearchScreen(onDone: () -> Unit, viewModel: FoodSearchViewModel, startScanner: Boolean = false) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    val resources = LocalResources.current

    LaunchedEffect(viewModel) {
        viewModel.events.collect { event ->
            when (event) {
                FoodSearchEvent.Added -> onDone()
                is FoodSearchEvent.ProductNotFound ->
                    snackbar.showSnackbar(resources.getString(R.string.food_barcode_not_found, event.barcode))
                FoodSearchEvent.ProductsUnavailable ->
                    snackbar.showSnackbar(resources.getString(R.string.food_products_unavailable))
            }
        }
    }

    FoodSearchScreen(state, viewModel::onAction, onBack = onDone, snackbar = snackbar, startScanner = startScanner)
}

private sealed interface FoodSearchDialog {
    data object CustomFood : FoodSearchDialog
    data object TextOnly : FoodSearchDialog
}

@Composable
internal fun FoodSearchScreen(
    state: FoodSearchUiState,
    onAction: (FoodSearchAction) -> Unit,
    onBack: () -> Unit,
    snackbar: SnackbarHostState = remember { SnackbarHostState() },
    startScanner: Boolean = false,
) {
    var dialog by remember { mutableStateOf<FoodSearchDialog?>(null) }
    val scope = rememberCoroutineScope()
    val resources = LocalResources.current
    val scan = rememberBarcodeScanner(
        onScanned = { onAction(FoodSearchAction.BarcodeScanned(it)) },
        onUnavailable = { scope.launch { snackbar.showSnackbar(resources.getString(R.string.food_scanner_unavailable)) } },
    )
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { if (startScanner) scan() else focus.requestFocus() }

    Scaffold(
        topBar = {
            TrackerTopBar(
                title = stringResource(R.string.food_search_title, state.target.mealName),
                navigation = { TrackerBackButton(onBack) },
                actions = {
                    IconButton(onClick = scan) {
                        Icon(painterResource(R.drawable.ic_barcode), stringResource(R.string.food_scan_barcode))
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(Modifier.padding(padding)) {
            OutlinedTextField(
                value = state.query,
                onValueChange = { onAction(FoodSearchAction.QueryChanged(it)) },
                placeholder = { Text(stringResource(R.string.food_search_hint)) },
                leadingIcon = { Icon(painterResource(R.drawable.ic_search), contentDescription = null) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).focusRequester(focus),
            )
            if (state.isLookingUpBarcode) ProgressTrack(0.35f, Modifier.padding(horizontal = Tracker.dimens.pageMargin, vertical = Tracker.dimens.sm))
            LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
                if (state.query.isBlank()) suggestions(state, onAction) else results(state, onAction)
                item {
                    ExtraActions(
                        state = state,
                        onCreateCustom = { dialog = FoodSearchDialog.CustomFood },
                        onAddAsText = { dialog = FoodSearchDialog.TextOnly },
                    )
                }
                item { Attribution() }
            }
        }
    }

    state.picked?.let { food ->
        AmountDialog(
            food = food,
            confirmLabel = stringResource(R.string.action_add),
            onConfirm = { onAction(FoodSearchAction.ConfirmAmount(it)) },
            onDismiss = { onAction(FoodSearchAction.DismissPick) },
        )
    }
    val dismiss = { dialog = null }
    when (dialog) {
        null -> Unit
        FoodSearchDialog.CustomFood -> CustomFoodDialog(
            initialName = state.query.trim(),
            onSave = { name, per100g, serving ->
                onAction(FoodSearchAction.CreateCustomFood(name, per100g, serving))
                dismiss()
            },
            onDismiss = dismiss,
        )
        FoodSearchDialog.TextOnly -> FoodDialog(
            title = stringResource(R.string.dialog_add_food_title, state.target.mealName),
            existing = null,
            initialName = state.query.trim(),
            onSave = { name, quantity ->
                onAction(FoodSearchAction.AddAsText(name, quantity))
                dismiss()
            },
            onDelete = null,
            onDismiss = dismiss,
        )
    }
}

private fun LazyListScope.suggestions(state: FoodSearchUiState, onAction: (FoodSearchAction) -> Unit) {
    foodSection(R.string.food_section_favorites, state.favorites, state, onAction)
    foodSection(R.string.food_section_recent, state.recentNotFavorite, state, onAction)
    if (state.favorites.isEmpty() && state.recent.isEmpty()) {
        item { Hint(stringResource(R.string.food_search_empty_hint)) }
    }
}

private fun LazyListScope.results(state: FoodSearchUiState, onAction: (FoodSearchAction) -> Unit) {
    foodSection(R.string.food_section_basic, state.localResults, state, onAction)
    item { SectionTitle(stringResource(R.string.food_section_products)) }
    when (val products = state.products) {
        ProductResults.Idle -> item { Hint(stringResource(R.string.food_products_type_more)) }
        ProductResults.Loading -> item {
            Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        }
        ProductResults.Unavailable -> item { Hint(stringResource(R.string.food_products_unavailable)) }
        is ProductResults.Found ->
            if (state.onlineProducts.isEmpty()) {
                item { Hint(stringResource(R.string.food_products_none)) }
            } else {
                foodRows("product", state.onlineProducts, state, onAction)
            }
    }
}

private fun LazyListScope.foodSection(
    title: Int,
    foods: List<FoodItem>,
    state: FoodSearchUiState,
    onAction: (FoodSearchAction) -> Unit,
) {
    if (foods.isEmpty()) return
    item(key = "title-$title") { SectionTitle(stringResource(title)) }
    foodRows("section-$title", foods, state, onAction)
}

/** Keys are prefixed because the same food can appear in more than one section. */
private fun LazyListScope.foodRows(
    keyPrefix: String,
    foods: List<FoodItem>,
    state: FoodSearchUiState,
    onAction: (FoodSearchAction) -> Unit,
) {
    items(foods, key = { "$keyPrefix-${it.id}" }) { food ->
        FoodRow(
            food = food,
            isFavorite = food.id in state.favoriteIds,
            onClick = { onAction(FoodSearchAction.Pick(food)) },
            onToggleFavorite = { onAction(FoodSearchAction.ToggleFavorite(food)) },
        )
    }
}

@Composable
private fun FoodRow(food: FoodItem, isFavorite: Boolean, onClick: () -> Unit, onToggleFavorite: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .clickable(onClick = onClick)
            .padding(start = 16.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f).padding(vertical = 8.dp)) {
            Text(food.name, style = MaterialTheme.typography.bodyLarge)
            Text(
                foodOriginLabel(food) + " · " + stringResource(R.string.per_100g, kcalLabel(food.per100g.kcal)),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        IconButton(onClick = onToggleFavorite) {
            Icon(
                painterResource(if (isFavorite) R.drawable.ic_star else R.drawable.ic_star_border),
                contentDescription = stringResource(if (isFavorite) R.string.food_unfavorite else R.string.food_favorite),
                tint = if (isFavorite) Tracker.colors.accent else Tracker.colors.inkTertiary,
            )
        }
    }
}

@Composable
private fun ExtraActions(state: FoodSearchUiState, onCreateCustom: () -> Unit, onAddAsText: () -> Unit) {
    Column(Modifier.padding(horizontal = 8.dp, vertical = 8.dp)) {
        HorizontalDivider(Modifier.padding(horizontal = 8.dp, vertical = 8.dp))
        TextButton(onClick = onCreateCustom) { Text(stringResource(R.string.food_create_custom)) }
        if (state.target is FoodTarget.DietMeal) {
            TextButton(onClick = onAddAsText) { Text(stringResource(R.string.food_add_as_text)) }
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    SectionLabel(
        text,
        Modifier.padding(start = Tracker.dimens.pageMargin, top = Tracker.dimens.lg, end = Tracker.dimens.pageMargin, bottom = Tracker.dimens.xs),
    )
}

@Composable
private fun Hint(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
    )
}

/** CREA asks to be cited; Open Food Facts' licence (ODbL) requires attribution. */
@Composable
private fun Attribution() {
    Text(
        stringResource(R.string.food_attribution),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
    )
}
