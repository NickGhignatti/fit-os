package com.nickghignatti.tracker.ui.templates

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nickghignatti.tracker.domain.repository.TemplateRepository
import com.nickghignatti.tracker.domain.usecase.ApplyTemplateUseCase
import com.nickghignatti.tracker.ui.common.stateInWhileSubscribed
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Clock
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch

@HiltViewModel
class TemplatesViewModel @Inject constructor(
    clock: Clock,
    private val templates: TemplateRepository,
    private val applyTemplate: ApplyTemplateUseCase,
) : ViewModel() {
    private val today = LocalDate.now(clock)

    val uiState: StateFlow<TemplatesUiState> = templates.observeTemplates()
        .map { TemplatesUiState(today, it, isLoading = false) }
        .stateInWhileSubscribed(this, TemplatesUiState(today))

    private val _events = Channel<TemplatesEvent>(Channel.BUFFERED)
    val events: Flow<TemplatesEvent> = _events.receiveAsFlow()

    fun onAction(action: TemplatesAction) {
        viewModelScope.launch {
            when (action) {
                is TemplatesAction.ApplyToDay ->
                    applyTemplate(action.templateId, action.date)?.let {
                        _events.send(TemplatesEvent.TemplateApplied(action.date))
                    }
                is TemplatesAction.Rename -> templates.renameTemplate(action.templateId, action.name.trim())
                is TemplatesAction.Delete -> templates.deleteTemplate(action.templateId)
            }
        }
    }
}
