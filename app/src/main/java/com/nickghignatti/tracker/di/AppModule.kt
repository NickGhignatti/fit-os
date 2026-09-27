package com.nickghignatti.tracker.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import java.time.Clock
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    /** Injected so "today" is controllable in tests. */
    @Provides
    @Singleton
    fun provideClock(): Clock = Clock.systemDefaultZone()
}
