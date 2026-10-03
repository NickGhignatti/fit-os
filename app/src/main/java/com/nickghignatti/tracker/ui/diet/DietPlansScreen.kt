package com.nickghignatti.tracker.ui.diet

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.DietPlan
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.repository.DietPlanRepository
import com.nickghignatti.tracker.ui.plans.PlanListScreen
import com.nickghignatti.tracker.ui.plans.PlanListTexts
import com.nickghignatti.tracker.ui.plans.PlanListViewModel
import com.nickghignatti.tracker.ui.plans.weekdaysSummary
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class DietPlansViewModel @Inject constructor(
    plans: DietPlanRepository,
) : PlanListViewModel<DietPlan>(plans)

private val texts = PlanListTexts(
    title = R.string.diet_title,
    newPlan = R.string.diet_new,
    defaultName = R.string.diet_default_name,
    empty = R.string.diet_plans_empty,
    dailyDescription = R.string.diet_daily_description,
    weeklyDescription = R.string.diet_weekly_description,
    deleteMessage = R.string.diet_delete_message,
)

@Composable
fun DietPlansScreen(
    onOpenPlan: (Long) -> Unit,
    viewModel: DietPlansViewModel = hiltViewModel(),
) {
    PlanListScreen(viewModel, texts, onOpenPlan) { plan -> dietPlanSummary(plan) }
}

/** "4 meals" for a daily plan, "Mon · Tue · Wed" for a weekly one. */
@Composable
private fun dietPlanSummary(plan: DietPlan): String = when {
    plan.plannedDays.isEmpty() -> stringResource(R.string.diet_summary_empty)
    plan.recurrence == Recurrence.WEEKLY -> weekdaysSummary(plan.plannedDays)
    else -> plan.mealsOn(PlanDay.EveryDay).size.let { pluralStringResource(R.plurals.meal_count, it, it) }
}
