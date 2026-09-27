package com.nickghignatti.tracker.ui.common

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn

/** Keeps the upstream alive briefly after the UI stops collecting, so rotations don't restart queries. */
private const val STOP_TIMEOUT_MS = 5_000L

fun <T> Flow<T>.stateInWhileSubscribed(viewModel: ViewModel, initialValue: T): StateFlow<T> =
    stateIn(viewModel.viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), initialValue)
