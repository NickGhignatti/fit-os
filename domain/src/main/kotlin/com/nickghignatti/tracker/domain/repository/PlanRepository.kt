package com.nickghignatti.tracker.domain.repository

import com.nickghignatti.tracker.domain.model.Plan
import com.nickghignatti.tracker.domain.model.Recurrence
import kotlinx.coroutines.flow.Flow

/** Operations every kind of plan supports. */
interface PlanRepository<P : Plan> {
    /** Plans sorted by name. */
    fun observePlans(): Flow<List<P>>

    /** Emits null once the plan is deleted. */
    fun observePlan(id: Long): Flow<P?>

    fun observeActivePlan(): Flow<P?>

    suspend fun getActivePlan(): P?

    /** Creates an empty, inactive plan; returns its id. */
    suspend fun createPlan(name: String, recurrence: Recurrence): Long

    suspend fun renamePlan(id: Long, name: String)

    suspend fun deletePlan(id: Long)

    /** Makes [id] the only active plan, or deactivates every plan when null. */
    suspend fun setActivePlan(id: Long?)
}
