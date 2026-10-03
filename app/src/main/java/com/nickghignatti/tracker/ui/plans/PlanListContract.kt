package com.nickghignatti.tracker.ui.plans

import com.nickghignatti.tracker.domain.model.Plan
import com.nickghignatti.tracker.domain.model.Recurrence

data class PlanListUiState<P : Plan>(
    val plans: List<P> = emptyList(),
    val isLoading: Boolean = true,
)

sealed interface PlanListAction {
    data class Create(val name: String, val recurrence: Recurrence) : PlanListAction
    data class Rename(val planId: Long, val name: String) : PlanListAction
    data class Delete(val planId: Long) : PlanListAction
    data class Activate(val planId: Long) : PlanListAction
    data object Deactivate : PlanListAction
}

sealed interface PlanListEvent {
    /** The plan exists now, so the screen can open it for editing. */
    data class PlanCreated(val planId: Long) : PlanListEvent
}
