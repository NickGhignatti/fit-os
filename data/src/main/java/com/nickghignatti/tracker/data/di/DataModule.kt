package com.nickghignatti.tracker.data.di

import android.content.Context
import com.nickghignatti.tracker.data.local.AppDatabase
import com.nickghignatti.tracker.data.repository.RoomDietPlanRepository
import com.nickghignatti.tracker.data.repository.RoomTrainingPlanRepository
import com.nickghignatti.tracker.data.repository.RoomTransactionRunner
import com.nickghignatti.tracker.data.repository.RoomWorkoutRepository
import com.nickghignatti.tracker.domain.repository.DietPlanRepository
import com.nickghignatti.tracker.domain.repository.TrainingPlanRepository
import com.nickghignatti.tracker.domain.repository.TransactionRunner
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/** Exposes the data layer only through its :domain interfaces. */
@Module
@InstallIn(SingletonComponent::class)
abstract class DataModule {
    @Binds
    internal abstract fun bindWorkoutRepository(impl: RoomWorkoutRepository): WorkoutRepository

    @Binds
    internal abstract fun bindTrainingPlanRepository(impl: RoomTrainingPlanRepository): TrainingPlanRepository

    @Binds
    internal abstract fun bindDietPlanRepository(impl: RoomDietPlanRepository): DietPlanRepository

    @Binds
    internal abstract fun bindTransactionRunner(impl: RoomTransactionRunner): TransactionRunner

    internal companion object {
        @Provides
        @Singleton
        fun provideDatabase(@ApplicationContext context: Context): AppDatabase = AppDatabase.build(context)
    }
}
