package com.nickghignatti.tracker.data.repository

import com.nickghignatti.tracker.data.local.AppDatabase
import com.nickghignatti.tracker.data.local.ProfileEntity
import com.nickghignatti.tracker.data.local.WeightEntryEntity
import com.nickghignatti.tracker.domain.model.Profile
import com.nickghignatti.tracker.domain.model.WeightEntry
import com.nickghignatti.tracker.domain.repository.ProfileRepository
import com.nickghignatti.tracker.domain.repository.WeightRepository
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

internal class RoomProfileRepository @Inject constructor(db: AppDatabase) : ProfileRepository {
    private val dao = db.profileDao()

    override fun observeProfile(): Flow<Profile> = dao.observe().map { it?.toDomain() ?: Profile() }

    override suspend fun saveProfile(profile: Profile) = dao.upsert(
        ProfileEntity(
            name = profile.name,
            sex = profile.sex,
            birthDate = profile.birthDate,
            heightCm = profile.heightCm,
            activity = profile.activity,
            pace = profile.pace,
            customKcal = profile.customKcal,
        ),
    )

    private fun ProfileEntity.toDomain() = Profile(name, sex, birthDate, heightCm, activity, pace, customKcal)
}

internal class RoomWeightRepository @Inject constructor(db: AppDatabase) : WeightRepository {
    private val dao = db.weightDao()

    override fun observeEntries(): Flow<List<WeightEntry>> =
        dao.observeAll().map { rows -> rows.map { WeightEntry(it.id, it.date, it.kg) } }

    override suspend fun logWeight(date: LocalDate, kg: Double) = dao.insert(WeightEntryEntity(date = date, kg = kg))

    override suspend fun deleteEntry(id: Long) = dao.delete(id)
}
