package com.nickghignatti.tracker.ui.calories

import android.content.Context
import com.nickghignatti.tracker.R
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Inject

/** The meals a day is split into when no diet plans it, in the user's language. */
fun interface DefaultMealNames {
    fun get(): List<String>
}

internal class ResourceMealNames @Inject constructor(
    @ApplicationContext private val context: Context,
) : DefaultMealNames {
    override fun get(): List<String> =
        listOf(R.string.meal_breakfast, R.string.meal_lunch, R.string.meal_snack, R.string.meal_dinner).map(context::getString)
}

@Module
@InstallIn(SingletonComponent::class)
internal abstract class CaloriesModule {
    @Binds
    abstract fun bindDefaultMealNames(impl: ResourceMealNames): DefaultMealNames
}
