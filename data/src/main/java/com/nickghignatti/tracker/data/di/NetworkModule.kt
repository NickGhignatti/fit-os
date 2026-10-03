package com.nickghignatti.tracker.data.di

import com.nickghignatti.tracker.data.remote.OpenFoodFactsEndpoints
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import java.util.concurrent.TimeUnit
import javax.inject.Singleton
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient

@Module
@InstallIn(SingletonComponent::class)
internal object NetworkModule {
    /** Open Food Facts asks every app to identify itself. */
    private const val USER_AGENT = "Tracker-Android/1.0 (personal nutrition app)"
    private const val TIMEOUT_SECONDS = 15L

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient = OkHttpClient.Builder()
        .callTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .addInterceptor { chain -> chain.proceed(chain.request().newBuilder().header("User-Agent", USER_AGENT).build()) }
        .build()

    /** Open Food Facts data is user-entered: unknown fields are common and numbers are sometimes quoted. */
    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
    }

    @Provides
    fun provideOpenFoodFactsEndpoints() = OpenFoodFactsEndpoints(
        products = "https://world.openfoodfacts.org/".toHttpUrl(),
        search = "https://search.openfoodfacts.org/".toHttpUrl(),
    )
}
