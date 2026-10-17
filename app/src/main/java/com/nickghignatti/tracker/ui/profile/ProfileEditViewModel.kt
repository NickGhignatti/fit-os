package com.nickghignatti.tracker.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nickghignatti.tracker.domain.model.Profile
import com.nickghignatti.tracker.domain.repository.ProfileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch

/** Null until the saved profile is loaded into the form. */
data class ProfileEditUiState(val profile: Profile? = null)

/** Edits a copy of the profile; nothing is stored until [save]. */
@HiltViewModel
class ProfileEditViewModel @Inject constructor(
    private val profiles: ProfileRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProfileEditUiState())
    val uiState: StateFlow<ProfileEditUiState> = _uiState.asStateFlow()

    private val _saved = Channel<Unit>(Channel.BUFFERED)
    val saved: Flow<Unit> = _saved.receiveAsFlow()

    init {
        viewModelScope.launch { _uiState.value = ProfileEditUiState(profiles.observeProfile().first()) }
    }

    fun update(transform: (Profile) -> Profile) {
        _uiState.value.profile?.let { _uiState.value = ProfileEditUiState(transform(it)) }
    }

    fun save() {
        val profile = _uiState.value.profile ?: return
        viewModelScope.launch {
            profiles.saveProfile(profile.copy(name = profile.name.trim()))
            _saved.send(Unit)
        }
    }
}
