package com.nickghignatti.tracker.domain.fake

import com.nickghignatti.tracker.domain.model.Profile
import com.nickghignatti.tracker.domain.model.WeightEntry
import com.nickghignatti.tracker.domain.repository.ProfileRepository
import com.nickghignatti.tracker.domain.repository.WeightRepository
import java.time.LocalDate
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update

/** In-memory [ProfileRepository] for tests. */
class FakeProfileRepository : ProfileRepository {
    private val state = MutableStateFlow(Profile())

    val profile: Profile get() = state.value

    override fun observeProfile(): Flow<Profile> = state

    override suspend fun saveProfile(profile: Profile) {
        state.value = profile
    }
}

/** In-memory [WeightRepository] for tests. */
class FakeWeightRepository : WeightRepository {
    private var lastId = 0L
    private val state = MutableStateFlow<List<WeightEntry>>(emptyList())

    val entries: List<WeightEntry> get() = state.value

    override fun observeEntries(): Flow<List<WeightEntry>> = state

    override suspend fun logWeight(date: LocalDate, kg: Double) = state.update { all ->
        (all.filterNot { it.date == date } + WeightEntry(++lastId, date, kg)).sortedBy { it.date }
    }

    override suspend fun deleteEntry(id: Long) = state.update { all -> all.filterNot { it.id == id } }
}
