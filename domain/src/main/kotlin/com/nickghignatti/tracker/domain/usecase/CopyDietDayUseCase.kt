package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.repository.DietPlanRepository
import com.nickghignatti.tracker.domain.repository.TransactionRunner
import javax.inject.Inject

/** Within a diet plan, replaces the meals of [targets] with a copy of [source]'s. */
class CopyDietDayUseCase @Inject constructor(
    private val dietPlans: DietPlanRepository,
    private val transaction: TransactionRunner,
) {
    suspend operator fun invoke(planId: Long, source: PlanDay, targets: Set<PlanDay>) = transaction.run {
        val meals = dietPlans.getMeals(planId, source)
        (targets - source).forEach { target -> dietPlans.replaceMeals(planId, target, meals) }
    }
}
