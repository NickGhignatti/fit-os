package com.nickghignatti.tracker.ui.plans

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nickghignatti.tracker.domain.model.Plan
import com.nickghignatti.tracker.domain.repository.PlanRepository
import com.nickghignatti.tracker.ui.common.stateInWhileSubscribed
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch

/** The training and diet plan lists behave the same; only the repository differs. */
abstract class PlanListViewModel<P : Plan>(
    private val plans: PlanRepository<P>,
) : ViewModel() {

    val uiState: StateFlow<PlanListUiState<P>> = plans.observePlans()
        .map { PlanListUiState(it, isLoading = false) }
        .stateInWhileSubscribed(this, PlanListUiState())

    private val _events = Channel<PlanListEvent>(Channel.BUFFERED)
    val events: Flow<PlanListEvent> = _events.receiveAsFlow()

    fun onAction(action: PlanListAction) {
        viewModelScope.launch {
            when (action) {
                is PlanListAction.Create ->
                    _events.send(PlanListEvent.PlanCreated(plans.createPlan(action.name.trim(), action.recurrence)))
                is PlanListAction.Rename -> plans.renamePlan(action.planId, action.name.trim())
                is PlanListAction.Delete -> plans.deletePlan(action.planId)
                is PlanListAction.Activate -> plans.setActivePlan(action.planId)
                PlanListAction.Deactivate -> plans.setActivePlan(null)
            }
        }
    }
}
