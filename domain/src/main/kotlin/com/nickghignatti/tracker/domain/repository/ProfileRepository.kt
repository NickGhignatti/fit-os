package com.nickghignatti.tracker.domain.repository

import com.nickghignatti.tracker.domain.model.Profile
import com.nickghignatti.tracker.domain.model.WeightEntry
import java.time.LocalDate
import kotlinx.coroutines.flow.Flow

interface ProfileRepository {
    /** An empty profile until the user saves one. */
    fun observeProfile(): Flow<Profile>

    suspend fun saveProfile(profile: Profile)
}

/** Weigh-ins, oldest first. */
interface WeightRepository {
    fun observeEntries(): Flow<List<WeightEntry>>

    /** Records the weight of [date], replacing that day's earlier weigh-in. */
    suspend fun logWeight(date: LocalDate, kg: Double)

    suspend fun deleteEntry(id: Long)
}
