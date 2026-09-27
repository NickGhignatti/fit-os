package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.repository.DietRepository
import com.nickghignatti.tracker.domain.repository.TransactionRunner
import java.time.DayOfWeek
import javax.inject.Inject

/** Replaces the meal plan of [targets] with a copy of [source]'s. */
class CopyDietDayUseCase @Inject constructor(
    private val diet: DietRepository,
    private val transaction: TransactionRunner,
) {
    suspend operator fun invoke(source: DayOfWeek, targets: Set<DayOfWeek>) = transaction.run {
        val meals = diet.getMeals(source)
        (targets - source).forEach { target -> diet.replaceMeals(target, meals) }
    }
}
