package com.nickghignatti.tracker.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nickghignatti.tracker.domain.repository.ProfileRepository
import com.nickghignatti.tracker.domain.repository.WeightRepository
import com.nickghignatti.tracker.domain.usecase.ObserveDailyTargetsUseCase
import com.nickghignatti.tracker.ui.common.stateInWhileSubscribed
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Clock
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

@HiltViewModel
class ProfileViewModel @Inject constructor(
    clock: Clock,
    profiles: ProfileRepository,
    private val weights: WeightRepository,
    observeDailyTargets: ObserveDailyTargetsUseCase,
) : ViewModel() {
    private val today = LocalDate.now(clock)

    val uiState: StateFlow<ProfileUiState> = combine(
        profiles.observeProfile(),
        weights.observeEntries(),
        observeDailyTargets(today),
    ) { profile, entries, targets ->
        ProfileUiState(today, profile, entries, targets, isLoading = false)
    }.stateInWhileSubscribed(this, ProfileUiState(today))

    fun onAction(action: ProfileAction) {
        viewModelScope.launch {
            when (action) {
                is ProfileAction.LogWeight -> weights.logWeight(action.date, action.kg)
                is ProfileAction.DeleteWeight -> weights.deleteEntry(action.id)
            }
        }
    }
}
