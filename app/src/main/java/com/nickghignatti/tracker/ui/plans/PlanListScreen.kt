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
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.Plan
import com.nickghignatti.tracker.ui.components.ConfirmDeleteDialog
import com.nickghignatti.tracker.ui.components.EmptyState
import com.nickghignatti.tracker.ui.components.MenuItem
import com.nickghignatti.tracker.ui.components.OverflowMenu
import com.nickghignatti.tracker.ui.components.TextInputDialog
import com.nickghignatti.tracker.ui.components.TrackerButton
import com.nickghignatti.tracker.ui.components.TrackerCard
import com.nickghignatti.tracker.ui.components.TrackerTopBar
import com.nickghignatti.tracker.ui.theme.ButtonKind
import com.nickghignatti.tracker.ui.theme.Tracker

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

internal sealed interface PlanDialog {
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
        topBar = {
            TrackerTopBar(
                title = stringResource(texts.title),
                actions = {
                    TrackerButton(
                        text = stringResource(texts.newPlan),
                        onClick = { dialog = PlanDialog.New },
                        icon = R.drawable.ic_add,
                        compact = true,
                    )
                },
            )
        },
    ) { padding ->
        when {
            state.isLoading -> Unit
            state.plans.isEmpty() -> EmptyState(stringResource(texts.empty), Modifier.padding(padding))
            else -> LazyColumn(
                modifier = Modifier.padding(padding),
                contentPadding = PaddingValues(Tracker.dimens.pageMargin),
                verticalArrangement = Arrangement.spacedBy(Tracker.dimens.md),
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

    PlanDialogs(dialog, texts, onAction, onDismiss = { dialog = null })
}

/** The dialogs that create, rename and delete a plan, for whichever list hosts them. */
@Composable
internal fun PlanDialogs(
    dialog: PlanDialog?,
    texts: PlanListTexts,
    onAction: (PlanListAction) -> Unit,
    onDismiss: () -> Unit,
) {
    val act = { action: PlanListAction ->
        onAction(action)
        onDismiss()
    }
    when (val current = dialog) {
        null -> Unit
        PlanDialog.New -> NewPlanDialog(
            title = stringResource(texts.newPlan),
            defaultName = stringResource(texts.defaultName),
            dailyDescription = stringResource(texts.dailyDescription),
            weeklyDescription = stringResource(texts.weeklyDescription),
            onCreate = { name, recurrence -> act(PlanListAction.Create(name, recurrence)) },
            onDismiss = onDismiss,
        )
        is PlanDialog.Rename -> TextInputDialog(
            title = stringResource(R.string.dialog_rename_plan_title),
            label = stringResource(R.string.label_name),
            initial = current.plan.name,
            onConfirm = { act(PlanListAction.Rename(current.plan.id, it)) },
            onDismiss = onDismiss,
        )
        is PlanDialog.Delete -> ConfirmDeleteDialog(
            title = stringResource(R.string.dialog_delete_plan_title, current.plan.name),
            message = stringResource(texts.deleteMessage),
            onConfirm = { act(PlanListAction.Delete(current.plan.id)) },
            onDismiss = onDismiss,
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
    TrackerCard(
        onClick = onOpen,
        modifier = Modifier.fillMaxWidth(),
        borderColor = if (plan.isActive) Tracker.colors.accent else Tracker.colors.border,
        contentPadding = PaddingValues(start = Tracker.dimens.lg, top = Tracker.dimens.md, end = Tracker.dimens.xs, bottom = Tracker.dimens.md),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Tracker.dimens.sm)) {
                Text(plan.name, style = Tracker.type.headlineMd, color = Tracker.colors.ink)
                Row(horizontalArrangement = Arrangement.spacedBy(Tracker.dimens.sm)) {
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
            style = Tracker.type.bodyMd,
            color = Tracker.colors.inkSecondary,
            modifier = Modifier.padding(top = Tracker.dimens.md, end = Tracker.dimens.md),
        )
        if (!plan.isActive) {
            TrackerButton(
                text = stringResource(R.string.plan_set_active),
                onClick = { onAction(PlanListAction.Activate(plan.id)) },
                kind = ButtonKind.Secondary,
                compact = true,
                modifier = Modifier.padding(top = Tracker.dimens.md),
            )
        }
    }
}
