package com.nickghignatti.tracker.data.di

import android.content.Context
import com.nickghignatti.tracker.data.local.AppDatabase
import com.nickghignatti.tracker.data.remote.CreaBasicFoodRepository
import com.nickghignatti.tracker.data.remote.FreeExerciseDbRepository
import com.nickghignatti.tracker.data.remote.OpenFoodFactsRepository
import com.nickghignatti.tracker.data.repository.RoomCustomFoodRepository
import com.nickghignatti.tracker.data.repository.RoomDietPlanRepository
import com.nickghignatti.tracker.data.repository.RoomFavoriteFoodRepository
import com.nickghignatti.tracker.data.repository.RoomFoodLogRepository
import com.nickghignatti.tracker.data.repository.RoomProfileRepository
import com.nickghignatti.tracker.data.repository.RoomWeightRepository
import com.nickghignatti.tracker.data.repository.RoomSavedProductRepository
import com.nickghignatti.tracker.data.repository.RoomTrainingPlanRepository
import com.nickghignatti.tracker.data.repository.RoomTransactionRunner
import com.nickghignatti.tracker.data.repository.RoomWorkoutRepository
import com.nickghignatti.tracker.domain.repository.BasicFoodRepository
import com.nickghignatti.tracker.domain.repository.CustomFoodRepository
import com.nickghignatti.tracker.domain.repository.DietPlanRepository
import com.nickghignatti.tracker.domain.repository.ExerciseCatalogRepository
import com.nickghignatti.tracker.domain.repository.FavoriteFoodRepository
import com.nickghignatti.tracker.domain.repository.FoodLogRepository
import com.nickghignatti.tracker.domain.repository.ProductRepository
import com.nickghignatti.tracker.domain.repository.ProfileRepository
import com.nickghignatti.tracker.domain.repository.SavedProductRepository
import com.nickghignatti.tracker.domain.repository.TrainingPlanRepository
import com.nickghignatti.tracker.domain.repository.TransactionRunner
import com.nickghignatti.tracker.domain.repository.WeightRepository
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
    internal abstract fun bindFoodLogRepository(impl: RoomFoodLogRepository): FoodLogRepository

    @Binds
    internal abstract fun bindCustomFoodRepository(impl: RoomCustomFoodRepository): CustomFoodRepository

    @Binds
    internal abstract fun bindFavoriteFoodRepository(impl: RoomFavoriteFoodRepository): FavoriteFoodRepository

    @Binds
    internal abstract fun bindBasicFoodRepository(impl: CreaBasicFoodRepository): BasicFoodRepository

    @Binds
    internal abstract fun bindProductRepository(impl: OpenFoodFactsRepository): ProductRepository

    @Binds
    internal abstract fun bindSavedProductRepository(impl: RoomSavedProductRepository): SavedProductRepository

    @Binds
    internal abstract fun bindExerciseCatalogRepository(impl: FreeExerciseDbRepository): ExerciseCatalogRepository

    @Binds
    internal abstract fun bindProfileRepository(impl: RoomProfileRepository): ProfileRepository

    @Binds
    internal abstract fun bindWeightRepository(impl: RoomWeightRepository): WeightRepository

    @Binds
    internal abstract fun bindTransactionRunner(impl: RoomTransactionRunner): TransactionRunner

    internal companion object {
        @Provides
        @Singleton
        fun provideDatabase(@ApplicationContext context: Context): AppDatabase = AppDatabase.build(context)
    }
}
