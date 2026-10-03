package com.nickghignatti.tracker.ui.food

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nickghignatti.tracker.domain.model.FoodSource
import com.nickghignatti.tracker.domain.model.Portion
import com.nickghignatti.tracker.domain.repository.CustomFoodRepository
import com.nickghignatti.tracker.domain.repository.DietPlanRepository
import com.nickghignatti.tracker.domain.repository.FavoriteFoodRepository
import com.nickghignatti.tracker.domain.repository.FoodLogRepository
import com.nickghignatti.tracker.domain.repository.ProductLookup
import com.nickghignatti.tracker.domain.repository.ProductRepository
import com.nickghignatti.tracker.domain.repository.ProductSearch
import com.nickghignatti.tracker.domain.repository.SavedProductRepository
import com.nickghignatti.tracker.domain.usecase.LookUpBarcodeUseCase
import com.nickghignatti.tracker.domain.usecase.SearchFoodsUseCase
import dagger.assisted.Assisted
import dagger.assisted.AssistedFactory
import dagger.assisted.AssistedInject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.mapLatest
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.transformLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Finds a food and adds an amount of it to [target]. Offline foods update as the user types;
 * packaged products are searched online only once typing pauses, to stay within the service's
 * rate limits.
 */
@OptIn(ExperimentalCoroutinesApi::class, FlowPreview::class)
@HiltViewModel(assistedFactory = FoodSearchViewModel.Factory::class)
class FoodSearchViewModel @AssistedInject constructor(
    @Assisted private val target: FoodTarget,
    private val searchFoods: SearchFoodsUseCase,
    private val lookUpBarcode: LookUpBarcodeUseCase,
    private val products: ProductRepository,
    private val savedProducts: SavedProductRepository,
    private val customFoods: CustomFoodRepository,
    private val favorites: FavoriteFoodRepository,
    private val foodLog: FoodLogRepository,
    private val dietPlans: DietPlanRepository,
) : ViewModel() {

    @AssistedFactory
    interface Factory {
        fun create(target: FoodTarget): FoodSearchViewModel
    }

    private val _uiState = MutableStateFlow(FoodSearchUiState(target))
    val uiState: StateFlow<FoodSearchUiState> = _uiState.asStateFlow()

    private val _events = Channel<FoodSearchEvent>(Channel.BUFFERED)
    val events: Flow<FoodSearchEvent> = _events.receiveAsFlow()

    init {
        favorites.observeFavorites().onEach { list -> _uiState.update { it.copy(favorites = list) } }.launchIn(viewModelScope)
        foodLog.observeRecentFoods(RECENT_LIMIT).onEach { list -> _uiState.update { it.copy(recent = list) } }.launchIn(viewModelScope)

        val query = _uiState.map { it.query.trim() }.distinctUntilChanged()
        query.mapLatest { searchFoods(it) }
            .onEach { results -> _uiState.update { it.copy(localResults = results) } }
            .launchIn(viewModelScope)
        query.debounce(PRODUCT_SEARCH_DELAY_MS)
            .transformLatest { text ->
                when {
                    text.length < MIN_PRODUCT_QUERY -> emit(ProductResults.Idle)
                    // A typed barcode: the fallback when the camera scanner is not available.
                    BARCODE.matches(text) -> {
                        emit(ProductResults.Loading)
                        emit(
                            when (val lookup = lookUpBarcode(text)) {
                                is ProductLookup.Found -> ProductResults.Found(listOf(lookup.product))
                                ProductLookup.NotFound -> ProductResults.Found(emptyList())
                                ProductLookup.Unavailable -> ProductResults.Unavailable
                            },
                        )
                    }
                    else -> {
                        emit(ProductResults.Loading)
                        emit(
                            when (val search = products.search(text)) {
                                is ProductSearch.Results -> ProductResults.Found(search.products)
                                ProductSearch.Unavailable -> ProductResults.Unavailable
                            },
                        )
                    }
                }
            }
            .onEach { results -> _uiState.update { it.copy(products = results) } }
            .launchIn(viewModelScope)
    }

    fun onAction(action: FoodSearchAction) {
        when (action) {
            is FoodSearchAction.QueryChanged -> _uiState.update { it.copy(query = action.query) }
            is FoodSearchAction.Pick -> _uiState.update { it.copy(picked = action.food) }
            FoodSearchAction.DismissPick -> _uiState.update { it.copy(picked = null) }
            is FoodSearchAction.ConfirmAmount -> _uiState.value.picked?.let { add(Portion(it, action.grams)) }
            is FoodSearchAction.ToggleFavorite -> viewModelScope.launch {
                favorites.setFavorite(action.food, favorite = action.food.id !in _uiState.value.favoriteIds)
            }
            is FoodSearchAction.BarcodeScanned -> lookUp(action.barcode)
            is FoodSearchAction.CreateCustomFood -> viewModelScope.launch {
                val food = customFoods.create(action.name, action.per100g, brand = null, servingGrams = action.servingGrams)
                _uiState.update { it.copy(picked = food) }
            }
            is FoodSearchAction.AddAsText -> (target as? FoodTarget.DietMeal)?.let { meal ->
                viewModelScope.launch {
                    dietPlans.addFood(meal.mealId, action.name.trim(), action.quantity.trim())
                    _events.send(FoodSearchEvent.Added)
                }
            }
        }
    }

    private fun add(portion: Portion) {
        _uiState.update { it.copy(picked = null) }
        viewModelScope.launch {
            // Products eaten or planned are kept, so they can be found again offline.
            if (portion.food.id.source == FoodSource.PRODUCT) savedProducts.save(portion.food)
            when (target) {
                is FoodTarget.Log -> foodLog.addEntry(target.date, target.mealName, portion)
                is FoodTarget.DietMeal -> dietPlans.addFood(target.mealId, portion.food.name, quantity = "", portion)
            }
            _events.send(FoodSearchEvent.Added)
        }
    }

    private fun lookUp(barcode: String) {
        _uiState.update { it.copy(isLookingUpBarcode = true) }
        viewModelScope.launch {
            val lookup = lookUpBarcode(barcode)
            _uiState.update { state ->
                state.copy(isLookingUpBarcode = false, picked = (lookup as? ProductLookup.Found)?.product ?: state.picked)
            }
            when (lookup) {
                is ProductLookup.Found -> Unit
                ProductLookup.NotFound -> _events.send(FoodSearchEvent.ProductNotFound(barcode))
                ProductLookup.Unavailable -> _events.send(FoodSearchEvent.ProductsUnavailable)
            }
        }
    }

    private companion object {
        const val RECENT_LIMIT = 15
        const val MIN_PRODUCT_QUERY = 3
        const val PRODUCT_SEARCH_DELAY_MS = 700L

        /** EAN-8, UPC-A, EAN-13 and GTIN-14 codes are all digits. */
        val BARCODE = Regex("\\d{8,14}")
    }
}
