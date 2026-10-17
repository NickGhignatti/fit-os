package com.nickghignatti.tracker.ui.profile

import com.nickghignatti.tracker.domain.model.DailyTargets
import com.nickghignatti.tracker.domain.model.Profile
import com.nickghignatti.tracker.domain.model.WeightEntry
import java.time.LocalDate

data class ProfileUiState(
    val today: LocalDate,
    val profile: Profile = Profile(),
    /** Oldest first. */
    val weights: List<WeightEntry> = emptyList(),
    val targets: DailyTargets? = null,
    val isLoading: Boolean = true,
) {
    val age: Int? get() = profile.ageOn(today)
    val latestWeight: WeightEntry? get() = weights.lastOrNull()

    /** What still stops the app from computing a goal, in the order the user would fill it in. */
    val missingForGoal: List<MissingInfo>
        get() = if (targets != null) {
            emptyList()
        } else {
            listOfNotNull(
                MissingInfo.SEX.takeIf { profile.sex == null },
                MissingInfo.BIRTH_DATE.takeIf { profile.birthDate == null },
                MissingInfo.HEIGHT.takeIf { profile.heightCm == null },
                MissingInfo.WEIGHT.takeIf { weights.isEmpty() },
            )
        }
}

enum class MissingInfo { SEX, BIRTH_DATE, HEIGHT, WEIGHT }

sealed interface ProfileAction {
    /** Records the day's weight, replacing that day's earlier weigh-in. */
    data class LogWeight(val date: LocalDate, val kg: Double) : ProfileAction
    data class DeleteWeight(val id: Long) : ProfileAction
}
