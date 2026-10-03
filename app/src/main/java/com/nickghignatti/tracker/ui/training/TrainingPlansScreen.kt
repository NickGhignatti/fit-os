package com.nickghignatti.tracker.ui.training

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.model.TrainingPlan
import com.nickghignatti.tracker.domain.repository.TrainingPlanRepository
import com.nickghignatti.tracker.ui.plans.PlanListScreen
import com.nickghignatti.tracker.ui.plans.PlanListTexts
import com.nickghignatti.tracker.ui.plans.PlanListViewModel
import com.nickghignatti.tracker.ui.plans.weekdaysSummary
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class TrainingPlansViewModel @Inject constructor(
    plans: TrainingPlanRepository,
) : PlanListViewModel<TrainingPlan>(plans)

private val texts = PlanListTexts(
    title = R.string.training_title,
    newPlan = R.string.training_new,
    defaultName = R.string.training_default_name,
    empty = R.string.training_empty,
    dailyDescription = R.string.training_daily_description,
    weeklyDescription = R.string.training_weekly_description,
    deleteMessage = R.string.training_delete_message,
)

@Composable
fun TrainingPlansScreen(
    onOpenPlan: (Long) -> Unit,
    viewModel: TrainingPlansViewModel = hiltViewModel(),
) {
    PlanListScreen(viewModel, texts, onOpenPlan) { plan -> trainingPlanSummary(plan) }
}

/** "4 exercises · 12 sets" for a daily plan, "Mon · Wed · Fri" for a weekly one. */
@Composable
private fun trainingPlanSummary(plan: TrainingPlan): String = when {
    plan.trainingDays.isEmpty() -> stringResource(R.string.training_summary_empty)
    plan.recurrence == Recurrence.WEEKLY -> weekdaysSummary(plan.trainingDays)
    else -> {
        val exercises = plan.sessionOn(PlanDay.EveryDay)
        val sets = exercises.sumOf { it.sets.size }
        stringResource(
            R.string.plan_summary,
            pluralStringResource(R.plurals.exercise_count, exercises.size, exercises.size),
            pluralStringResource(R.plurals.set_count, sets, sets),
        )
    }
}
