package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.model.TrainingPlan
import com.nickghignatti.tracker.domain.repository.TrainingPlanRepository
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine

/** One training day of the current week and whether its workout is fully done. */
data class TrainingWeekDay(val date: LocalDate, val isCompleted: Boolean, val isToday: Boolean)

/** How the active plan is going this week (Monday to Sunday). */
data class TrainingWeek(
    val plan: TrainingPlan,
    /** The days of the week the plan has a session on. */
    val days: List<TrainingWeekDay>,
    /** Today has a session in the plan that has not been started yet. */
    val hasPendingSessionToday: Boolean,
) {
    val completedCount: Int get() = days.count { it.isCompleted }
}

class ObserveTrainingWeekUseCase @Inject constructor(
    private val workouts: WorkoutRepository,
    private val trainingPlans: TrainingPlanRepository,
) {
    /** Emits null while there is no active plan. */
    operator fun invoke(today: LocalDate): Flow<TrainingWeek?> {
        val monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        return combine(
            trainingPlans.observeActivePlan(),
            workouts.observeDaySummaries(monday, monday.plusDays(DAYS_IN_WEEK - 1)),
            workouts.observeWorkouts(today),
        ) { plan, summaries, todaysWorkouts ->
            plan?.let {
                val completed = summaries.filter { it.isCompleted }.map { it.date }.toSet()
                TrainingWeek(
                    plan = plan,
                    days = (0L until DAYS_IN_WEEK).map(monday::plusDays)
                        .filter { plan.sessionOn(it).isNotEmpty() }
                        .map { TrainingWeekDay(it, isCompleted = it in completed, isToday = it == today) },
                    hasPendingSessionToday = plan.pendingSessionOn(today, todaysWorkouts) != null,
                )
            }
        }
    }

    private companion object {
        const val DAYS_IN_WEEK = 7L
    }
}
