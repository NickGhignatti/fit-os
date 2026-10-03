package com.nickghignatti.tracker.domain.repository

import com.nickghignatti.tracker.domain.model.FoodItem
import com.nickghignatti.tracker.domain.model.FoodLogEntry
import com.nickghignatti.tracker.domain.model.Portion
import java.time.LocalDate
import kotlinx.coroutines.flow.Flow

/** What was eaten, day by day. Entries are returned in the order they were logged. */
interface FoodLogRepository {
    fun observeEntries(date: LocalDate): Flow<List<FoodLogEntry>>

    /** Appends an entry; returns its id. */
    suspend fun addEntry(date: LocalDate, meal: String, portion: Portion): Long

    suspend fun updateGrams(id: Long, grams: Double)

    suspend fun deleteEntry(id: Long)

    /** Distinct foods, most recently logged first. */
    fun observeRecentFoods(limit: Int): Flow<List<FoodItem>>
}
