package com.nickghignatti.tracker.data.repository

import androidx.room.withTransaction
import com.nickghignatti.tracker.data.local.AppDatabase
import com.nickghignatti.tracker.domain.repository.TransactionRunner
import javax.inject.Inject

internal class RoomTransactionRunner @Inject constructor(
    private val db: AppDatabase,
) : TransactionRunner {
    override suspend fun <R> run(block: suspend () -> R): R = db.withTransaction { block() }
}
