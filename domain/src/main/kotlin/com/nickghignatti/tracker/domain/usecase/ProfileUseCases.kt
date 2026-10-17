package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.model.DailyTargets
import com.nickghignatti.tracker.domain.model.NutritionTargets
import com.nickghignatti.tracker.domain.repository.ProfileRepository
import com.nickghignatti.tracker.domain.repository.WeightRepository
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine

/** The daily targets on [today], from the profile and the latest weigh-in; null until enough is known. */
class ObserveDailyTargetsUseCase @Inject constructor(
    private val profiles: ProfileRepository,
    private val weights: WeightRepository,
) {
    operator fun invoke(today: LocalDate): Flow<DailyTargets?> =
        combine(profiles.observeProfile(), weights.observeEntries()) { profile, entries ->
            NutritionTargets.forProfile(profile, weightKg = entries.lastOrNull()?.kg, age = profile.ageOn(today))
        }
}
