package com.nickghignatti.tracker.domain.repository

/**
 * Runs a block atomically across repositories, so a use case that reads and writes
 * several of them either fully succeeds or leaves no trace.
 */
interface TransactionRunner {
    suspend fun <R> run(block: suspend () -> R): R
}
