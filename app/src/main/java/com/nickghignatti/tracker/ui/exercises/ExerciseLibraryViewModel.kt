package com.nickghignatti.tracker.ui.exercises

import androidx.lifecycle.ViewModel
import com.nickghignatti.tracker.domain.model.Equipment
import com.nickghignatti.tracker.domain.model.ExerciseFilter
import com.nickghignatti.tracker.domain.model.ExerciseInfo
import com.nickghignatti.tracker.domain.model.Muscle
import com.nickghignatti.tracker.domain.repository.ExerciseCatalogRepository
import com.nickghignatti.tracker.ui.common.stateInWhileSubscribed
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.mapLatest
import kotlinx.coroutines.flow.update

data class ExerciseLibraryUiState(
    val query: String = "",
    val filter: ExerciseFilter = ExerciseFilter(),
    val results: List<ExerciseInfo> = emptyList(),
    val isLoading: Boolean = true,
)

/** Browses the exercise catalogue on its own, without adding anything anywhere. */
@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class ExerciseLibraryViewModel @Inject constructor(
    catalog: ExerciseCatalogRepository,
) : ViewModel() {
    private val query = MutableStateFlow("")
    private val filter = MutableStateFlow(ExerciseFilter())

    val uiState: StateFlow<ExerciseLibraryUiState> =
        combine(query, filter, ::Pair)
            .mapLatest { (text, current) -> ExerciseLibraryUiState(text, current, catalog.search(text.trim(), current), isLoading = false) }
            .stateInWhileSubscribed(this, ExerciseLibraryUiState())

    fun onQueryChanged(text: String) {
        query.value = text
    }

    /** Choosing the selected value again clears it. */
    fun onToggleMuscle(muscle: Muscle) = filter.update { it.copy(muscle = muscle.takeUnless { m -> m == it.muscle }) }

    fun onToggleEquipment(equipment: Equipment) =
        filter.update { it.copy(equipment = equipment.takeUnless { e -> e == it.equipment }) }
}
