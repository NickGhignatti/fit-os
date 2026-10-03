@file:OptIn(ExperimentalMaterial3Api::class)

package com.nickghignatti.tracker.ui.plans

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.Plan
import com.nickghignatti.tracker.ui.components.ConfirmDeleteDialog
import com.nickghignatti.tracker.ui.components.EmptyState
import com.nickghignatti.tracker.ui.components.MenuItem
import com.nickghignatti.tracker.ui.components.OverflowMenu
import com.nickghignatti.tracker.ui.components.TextInputDialog

/** The texts that differ between the training and the diet plan lists. */
class PlanListTexts(
    @param:StringRes val title: Int,
    @param:StringRes val newPlan: Int,
    @param:StringRes val defaultName: Int,
    @param:StringRes val empty: Int,
    @param:StringRes val dailyDescription: Int,
    @param:StringRes val weeklyDescription: Int,
    @param:StringRes val deleteMessage: Int,
)

private sealed interface PlanDialog {
    data object New : PlanDialog
    data class Rename(val plan: Plan) : PlanDialog
    data class Delete(val plan: Plan) : PlanDialog
}

@Composable
fun <P : Plan> PlanListScreen(
    viewModel: PlanListViewModel<P>,
    texts: PlanListTexts,
    onOpenPlan: (Long) -> Unit,
    summary: @Composable (P) -> String,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(viewModel) {
        viewModel.events.collect { event ->
            when (event) {
                is PlanListEvent.PlanCreated -> onOpenPlan(event.planId)
            }
        }
    }

    PlanListScreen(state, texts, viewModel::onAction, onOpenPlan, summary)
}

@Composable
internal fun <P : Plan> PlanListScreen(
    state: PlanListUiState<P>,
    texts: PlanListTexts,
    onAction: (PlanListAction) -> Unit,
    onOpenPlan: (Long) -> Unit,
    summary: @Composable (P) -> String,
) {
    var dialog by remember { mutableStateOf<PlanDialog?>(null) }

    Scaffold(
        topBar = { TopAppBar(title = { Text(stringResource(texts.title)) }) },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { dialog = PlanDialog.New },
                icon = { Icon(painterResource(R.drawable.ic_add), contentDescription = null) },
                text = { Text(stringResource(texts.newPlan)) },
            )
        },
    ) { padding ->
        when {
            state.isLoading -> Unit
            state.plans.isEmpty() -> EmptyState(stringResource(texts.empty), Modifier.padding(padding))
            else -> LazyColumn(
                modifier = Modifier.padding(padding),
                contentPadding = PaddingValues(start = 16.dp, top = 8.dp, end = 16.dp, bottom = 96.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(state.plans, key = { it.id }) { plan ->
                    PlanCard(
                        plan = plan,
                        summary = summary(plan),
                        onOpen = { onOpenPlan(plan.id) },
                        onAction = onAction,
                        onOpenDialog = { dialog = it },
                    )
                }
            }
        }
    }

    val dismiss = { dialog = null }
    val act = { action: PlanListAction ->
        onAction(action)
        dismiss()
    }
    when (val current = dialog) {
        null -> Unit
        PlanDialog.New -> NewPlanDialog(
            title = stringResource(texts.newPlan),
            defaultName = stringResource(texts.defaultName),
            dailyDescription = stringResource(texts.dailyDescription),
            weeklyDescription = stringResource(texts.weeklyDescription),
            onCreate = { name, recurrence -> act(PlanListAction.Create(name, recurrence)) },
            onDismiss = dismiss,
        )
        is PlanDialog.Rename -> TextInputDialog(
            title = stringResource(R.string.dialog_rename_plan_title),
            label = stringResource(R.string.label_name),
            initial = current.plan.name,
            onConfirm = { act(PlanListAction.Rename(current.plan.id, it)) },
            onDismiss = dismiss,
        )
        is PlanDialog.Delete -> ConfirmDeleteDialog(
            title = stringResource(R.string.dialog_delete_plan_title, current.plan.name),
            message = stringResource(texts.deleteMessage),
            onConfirm = { act(PlanListAction.Delete(current.plan.id)) },
            onDismiss = dismiss,
        )
    }
}

@Composable
private fun PlanCard(
    plan: Plan,
    summary: String,
    onOpen: () -> Unit,
    onAction: (PlanListAction) -> Unit,
    onOpenDialog: (PlanDialog) -> Unit,
) {
    ElevatedCard(onClick = onOpen, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(start = 16.dp, top = 8.dp, end = 4.dp, bottom = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(plan.name, style = MaterialTheme.typography.titleLarge)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        PlanLabel(recurrenceLabel(plan.recurrence))
                        if (plan.isActive) PlanLabel(stringResource(R.string.plan_active), highlighted = true)
                    }
                }
                OverflowMenu(
                    listOf(
                        if (plan.isActive) {
                            MenuItem(stringResource(R.string.plan_deactivate)) { onAction(PlanListAction.Deactivate) }
                        } else {
                            MenuItem(stringResource(R.string.plan_set_active)) { onAction(PlanListAction.Activate(plan.id)) }
                        },
                        MenuItem(stringResource(R.string.action_rename)) { onOpenDialog(PlanDialog.Rename(plan)) },
                        MenuItem(stringResource(R.string.action_delete)) { onOpenDialog(PlanDialog.Delete(plan)) },
                    ),
                )
            }
            Text(
                summary,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp, end = 12.dp),
            )
            if (!plan.isActive) {
                TextButton(onClick = { onAction(PlanListAction.Activate(plan.id)) }, modifier = Modifier.padding(top = 4.dp)) {
                    Text(stringResource(R.string.plan_set_active))
                }
            }
        }
    }
}
