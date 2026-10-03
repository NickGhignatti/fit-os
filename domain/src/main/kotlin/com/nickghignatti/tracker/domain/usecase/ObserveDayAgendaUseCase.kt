package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.model.DayAgenda
import com.nickghignatti.tracker.domain.model.PendingSession
import com.nickghignatti.tracker.domain.model.TrainingPlan
import com.nickghignatti.tracker.domain.model.Workout
import com.nickghignatti.tracker.domain.repository.DietPlanRepository
import com.nickghignatti.tracker.domain.repository.TrainingPlanRepository
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine

/**
 * A day's agenda: its workouts, the active training plan's session while it has not been started,
 * and the active diet plan's meals. Plans are never copied ahead of time, so switching plan takes
 * effect immediately.
 */
class ObserveDayAgendaUseCase @Inject constructor(
    private val workouts: WorkoutRepository,
    private val trainingPlans: TrainingPlanRepository,
    private val dietPlans: DietPlanRepository,
) {
    operator fun invoke(date: LocalDate): Flow<DayAgenda> = combine(
        workouts.observeWorkouts(date),
        trainingPlans.observeActivePlan(),
        dietPlans.observeActivePlan(),
    ) { dayWorkouts, trainingPlan, dietPlan ->
        DayAgenda(
            date = date,
            workouts = dayWorkouts,
            pendingSession = trainingPlan?.pendingSessionOn(date, dayWorkouts),
            meals = dietPlan?.mealsOn(date).orEmpty(),
            hasTrainingPlan = trainingPlan != null,
            hasDietPlan = dietPlan != null,
        )
    }
}

/** The plan's session for [date], unless it is a rest day or a workout was already started from it. */
internal fun TrainingPlan.pendingSessionOn(date: LocalDate, dayWorkouts: List<Workout>): PendingSession? {
    val session = sessionOn(date)
    if (session.isEmpty() || dayWorkouts.any { it.planId == id }) return null
    return PendingSession(planId = id, title = name, exercises = session.map { it.toPlan() })
}
