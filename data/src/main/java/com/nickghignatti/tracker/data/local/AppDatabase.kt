package com.nickghignatti.tracker.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters

@Database(
    entities = [
        WorkoutEntity::class,
        ExerciseEntity::class,
        SetEntity::class,
        TemplateEntity::class,
        TemplateExerciseEntity::class,
        TemplateSetEntity::class,
        MealEntity::class,
        FoodEntity::class,
    ],
    version = 1,
    exportSchema = true,
)
@TypeConverters(Converters::class)
internal abstract class AppDatabase : RoomDatabase() {
    abstract fun workoutDao(): WorkoutDao
    abstract fun templateDao(): TemplateDao
    abstract fun dietDao(): DietDao

    companion object {
        private const val NAME = "tracker.db"

        fun build(context: Context): AppDatabase =
            Room.databaseBuilder(context, AppDatabase::class.java, NAME).build()
    }
}
