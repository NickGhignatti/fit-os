package com.nickghignatti.tracker.ui.templates

import com.nickghignatti.tracker.domain.model.WorkoutTemplate
import java.time.LocalDate

data class TemplatesUiState(
    val today: LocalDate,
    val templates: List<WorkoutTemplate> = emptyList(),
    val isLoading: Boolean = true,
)

sealed interface TemplatesAction {
    data class ApplyToDay(val templateId: Long, val date: LocalDate) : TemplatesAction
    data class Rename(val templateId: Long, val name: String) : TemplatesAction
    data class Delete(val templateId: Long) : TemplatesAction
}

sealed interface TemplatesEvent {
    /** The workout exists now, so the screen can navigate to its day. */
    data class TemplateApplied(val date: LocalDate) : TemplatesEvent
}
