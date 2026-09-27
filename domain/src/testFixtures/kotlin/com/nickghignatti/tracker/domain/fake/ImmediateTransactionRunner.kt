package com.nickghignatti.tracker.domain.fake

import com.nickghignatti.tracker.domain.repository.TransactionRunner

/** Runs the block directly; the in-memory fakes need no real transaction. */
class ImmediateTransactionRunner : TransactionRunner {
    override suspend fun <R> run(block: suspend () -> R): R = block()
}
