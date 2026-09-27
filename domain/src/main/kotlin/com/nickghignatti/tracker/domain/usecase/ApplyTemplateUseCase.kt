package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.repository.TemplateRepository
import com.nickghignatti.tracker.domain.repository.TransactionRunner
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import java.time.LocalDate
import javax.inject.Inject

/** Creates a new workout on a day from a template. */
class ApplyTemplateUseCase @Inject constructor(
    private val templates: TemplateRepository,
    private val workouts: WorkoutRepository,
    private val transaction: TransactionRunner,
) {
    /** Returns the new workout's id, or null if the template no longer exists. */
    suspend operator fun invoke(templateId: Long, date: LocalDate): Long? = transaction.run {
        val template = templates.getTemplate(templateId) ?: return@run null
        workouts.createWorkout(date, template.name, template.exercises)
    }
}
